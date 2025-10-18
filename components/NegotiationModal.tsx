import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Negotiation, UserWithStatus, GameSettings, GameMode, ServerAction, DiceGoVariant, Player, AlkkagiPlacementType, AlkkagiLayoutType, User } from '../types/index.js';
import { 
    BOARD_SIZES, TIME_LIMITS, BYOYOMI_COUNTS, BYOYOMI_TIMES, DEFAULT_KOMI, CAPTURE_TARGETS, SPEED_BOARD_SIZES,
    SPEED_TIME_LIMITS, FISCHER_INCREMENT_SECONDS, BASE_STONE_COUNTS, HIDDEN_STONE_COUNTS, SCAN_COUNTS,
    CAPTURE_BOARD_SIZES, OMOK_BOARD_SIZES, TTAMOK_CAPTURE_TARGETS, ALKKAGI_STONE_COUNTS,
    ALKKAGI_GAUGE_SPEEDS, CURLING_GAUGE_SPEEDS, CURLING_STONE_COUNTS, HIDDEN_BOARD_SIZES, THIEF_BOARD_SIZES,
    MISSILE_BOARD_SIZES, MISSILE_COUNTS, SPECIAL_GAME_MODES, DEFAULT_GAME_SETTINGS, aiUserId, DICE_GO_ITEM_COUNTS, CURLING_ITEM_COUNTS, ALKKAGI_ITEM_COUNTS, ALKKAGI_ROUNDS,
    CURLING_ROUNDS, AVATAR_POOL, BORDER_POOL,
    PLAYFUL_GAME_MODES, STRATEGIC_ACTION_POINT_COST, PLAYFUL_ACTION_POINT_COST, strategicAiDisplayMap, captureAiLevelMap, AUTO_END_TURN_COUNTS
} from '../constants/index.js';
import { audioService } from '../services/audioService.js';
import Button from './Button.js';
import DraggableWindow from './DraggableWindow.js';
import Avatar from './Avatar.js';

interface NegotiationModalProps {
  negotiation: Negotiation;
  currentUser: UserWithStatus;
  onAction: (action: ServerAction) => void;
  onlineUsers: UserWithStatus[];
  isTopmost?: boolean;
}

const PREFERRED_SETTINGS_KEY_PREFIX = 'preferredGameSettings';

const SettingRow: React.FC<{ label: string, children: React.ReactNode, className?: string }> = ({ label, children, className }) => (
    <div className={`grid grid-cols-2 gap-4 items-center ${className}`}>
        <label className="font-semibold text-gray-300">{label}</label>
        {children}
    </div>
);

// A component that handles its own timer to prevent re-rendering the whole modal.
const CountdownDisplay: React.FC<{ deadline: number }> = ({ deadline }) => {
    const [countdown, setCountdown] = useState(() => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

    useEffect(() => {
        setCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        const timer = setInterval(() => {
            setCountdown(prev => {
                const newCountdown = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
                // Only update state if the value has changed to avoid unnecessary re-renders of the span itself
                return prev !== newCountdown ? newCountdown : prev;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [deadline]);

    return <span>({countdown}초)</span>;
};

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

const getAutoEndTurnOptions = (boardSize: number): number[] => {
    if (boardSize <= 9) return AUTO_END_TURN_COUNTS.small;
    if (boardSize <= 13) return AUTO_END_TURN_COUNTS.medium;
    if (boardSize <= 17) return AUTO_END_TURN_COUNTS.large;
    return AUTO_END_TURN_COUNTS.full;
};

import { getDefaultSettingsForMode } from '../constants/index.js';

const NegotiationModal: React.FC<NegotiationModalProps> = (props) => {
  const { negotiation, currentUser, onAction, onlineUsers, isTopmost } = props;
  const { mode } = negotiation;
  const [settings, setSettings] = useState<GameSettings>(() => {
      const isAiGame = negotiation.opponent.id === aiUserId;
      const isCreatingDraft = negotiation.status === 'draft' && negotiation.proposerId === currentUser.id;
      const defaultModeSettings = getDefaultSettingsForMode(negotiation.mode);
      let initialSettings: GameSettings = { ...defaultModeSettings, ...negotiation.settings } as GameSettings;
      const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === negotiation.mode);

      if (isCreatingDraft) {
          try {
              const storageKey = `${PREFERRED_SETTINGS_KEY_PREFIX}_${negotiation.mode}`;
              const savedSettingsJSON = localStorage.getItem(storageKey);
              if (savedSettingsJSON) {
                  const savedSettings = JSON.parse(savedSettingsJSON);
                  initialSettings = { ...initialSettings, ...savedSettings };
              }
          } catch (e) { console.error("Failed to load preferred settings", e); }
      }
      
      if (isAiGame && !initialSettings.player1Color) initialSettings.player1Color = Player.Black;
      
      const getValidSizes = (mode: GameMode): readonly number[] => {
          switch (mode) {
              case GameMode.Omok: case GameMode.Ttamok: return OMOK_BOARD_SIZES;
              case GameMode.Capture: return CAPTURE_BOARD_SIZES;
              case GameMode.Speed: return SPEED_BOARD_SIZES;
              case GameMode.Hidden: return HIDDEN_BOARD_SIZES;
              case GameMode.Thief: return THIEF_BOARD_SIZES;
              case GameMode.Missile: return MISSILE_BOARD_SIZES;
              case GameMode.Alkkagi: case GameMode.Curling: case GameMode.Dice: return [19];
              default: return BOARD_SIZES;
          }
      };
      const validBoardSizes = getValidSizes(negotiation.mode);
      if (!validBoardSizes.includes(initialSettings.boardSize)) {
          initialSettings.boardSize = validBoardSizes[0] as GameSettings['boardSize'];
      }
      
      if (isCreatingDraft && isAiGame && isStrategic) {
          const options = getAutoEndTurnOptions(initialSettings.boardSize);
          initialSettings.autoEndTurnCount = options[0];
      }

      return initialSettings;
  });
  
  const notificationPlayedRef = useRef(false);

  const iAmProposer = negotiation.proposerId === currentUser.id;
  const isPending = negotiation.status === 'pending';
  const isDraft = negotiation.status === 'draft';
  const isCreatingDraft = isDraft && iAmProposer;
  const isMyTurnToRespond = isPending && iAmProposer;
  const isWaitingForOpponent = isPending && !iAmProposer;
  
  const handleSettingChange = useCallback(<K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setSettings(prev => ({ ...prev, [key]: value })), []);
  
  const opponent = useMemo(() => {
    const initialOpponent = negotiation.challenger.id === currentUser.id ? negotiation.opponent : negotiation.challenger;
    if (initialOpponent.id === aiUserId) {
      const difficulty = settings.aiDifficulty || 10;
      const difficultyStep = Math.max(1, Math.min(10, Math.round(difficulty / 10)));
      
      let botName: string;
      let displayLevel: number;
      let botPlayfulLevelForEngine = 1; // used for engine level

      const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === negotiation.mode);
      const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === negotiation.mode);

      if (isPlayful) {
          displayLevel = difficultyStep;
          botName = `${negotiation.mode}봇 ${displayLevel}단`;
          botPlayfulLevelForEngine = displayLevel;
      } else if (isStrategic) {
          if (negotiation.mode === GameMode.Capture) {
              displayLevel = captureAiLevelMap[difficultyStep - 1];
              botName = `따내기봇 ${displayLevel}단`;
          } else {
              displayLevel = strategicAiDisplayMap[difficultyStep - 1];
              botName = `${negotiation.mode}봇 ${difficultyStep}단계`;
          }
          botPlayfulLevelForEngine = difficultyStep; // engine uses 1-10
      } else { // Fallback
          displayLevel = strategicAiDisplayMap[difficultyStep - 1];
          botName = `${negotiation.mode}봇 ${difficultyStep}단계`;
          botPlayfulLevelForEngine = difficultyStep;
      }
      
      return { 
          ...initialOpponent, 
          nickname: botName, 
          strategyLevel: isStrategic ? displayLevel : 1, 
          playfulLevel: isPlayful ? displayLevel : botPlayfulLevelForEngine,
      };
    }
    const freshOpponent = onlineUsers.find(u => u.id === initialOpponent.id);
    return freshOpponent || initialOpponent;
  }, [negotiation.challenger, negotiation.opponent, negotiation.mode, currentUser.id, onlineUsers, settings.aiDifficulty]);

  const isAiGame = opponent.id === aiUserId;
  const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === negotiation.mode);
  
  useEffect(() => {
    if (isCreatingDraft && isAiGame && isStrategic) {
        const options = getAutoEndTurnOptions(settings.boardSize);
        if (settings.autoEndTurnCount === undefined || !options.includes(settings.autoEndTurnCount)) {
            handleSettingChange('autoEndTurnCount', options[0]);
        }
    }
  }, [settings.boardSize, isCreatingDraft, isAiGame, isStrategic, handleSettingChange]);


  const onDecline = useCallback(() => {
    onAction({ type: 'DECLINE_NEGOTIATION', payload: { negotiationId: negotiation.id } });
  }, [onAction, negotiation.id]);

  const prevTurnCount = usePrevious(negotiation.turnCount);
  useEffect(() => {
      // Opponent has made a counter-proposal, update settings to match their proposal.
      if (negotiation.turnCount !== prevTurnCount && (negotiation.turnCount || 0) > 0 && iAmProposer) {
          setSettings({ ...DEFAULT_GAME_SETTINGS, ...negotiation.settings });
      }
  }, [negotiation.turnCount, prevTurnCount, negotiation.settings, iAmProposer]);

  useEffect(() => {
    if (isMyTurnToRespond && !notificationPlayedRef.current) {
        audioService.myTurn();
        notificationPlayedRef.current = true;
    }
  }, [isMyTurnToRespond]);
  
  const opponentStats = useMemo(() => {
    const isStrategicOp = SPECIAL_GAME_MODES.some(m => m.mode === negotiation.mode);
    const level = isStrategicOp ? opponent.strategyLevel : opponent.playfulLevel;
    const stats = opponent.stats?.[negotiation.mode];
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;
    const mannerScore = opponent.mannerScore ?? 200;
    const totalGames = wins + losses;
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    
    return { level, levelLabel: isStrategicOp ? '전략' : '놀이', wins, losses, mannerScore, winRate };
  }, [opponent, negotiation.mode]);

  const opponentAvatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === opponent.avatarId)?.url, [opponent.avatarId]);
  const opponentBorderUrl = useMemo(() => BORDER_POOL.find(b => b.id === opponent.borderId)?.url, [opponent.borderId]);

  const actionPointCost = useMemo(() => {
    if (SPECIAL_GAME_MODES.some(m => m.mode === negotiation.mode)) {
        return STRATEGIC_ACTION_POINT_COST;
    }
    if (PLAYFUL_GAME_MODES.some(m => m.mode === negotiation.mode)) {
        return PLAYFUL_ACTION_POINT_COST;
    }
    return STRATEGIC_ACTION_POINT_COST; // Default
  }, [negotiation.mode]);

  const settingsHaveChanged = useMemo(() => JSON.stringify(settings) !== JSON.stringify(negotiation.settings), [settings, negotiation.settings]);
  
  const handleMixedModeChange = (mode: GameMode, checked: boolean) => setSettings(prev => ({ ...prev, mixedModes: checked ? [...(prev.mixedModes || []), mode] : (prev.mixedModes || []).filter(m => m !== mode) }));
  
  const saveSettingsAndAct = useCallback((action: ServerAction) => {
     try {
        const storageKey = `${PREFERRED_SETTINGS_KEY_PREFIX}_${negotiation.mode}`;
        localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save preferred settings", e);
    }
    onAction(action);
  }, [onAction, settings, negotiation.mode]);

  const onAccept = () => onAction({ type: 'ACCEPT_NEGOTIATION', payload: { negotiationId: negotiation.id, settings } });
  const onPropose = () => onAction({ type: 'UPDATE_NEGOTIATION', payload: { negotiationId: negotiation.id, settings } });
  const onSendChallenge = () => saveSettingsAndAct({ type: 'SEND_CHALLENGE', payload: { negotiationId: negotiation.id, settings } });
  const onStartAiGame = () => saveSettingsAndAct({ type: 'START_AI_GAME', payload: { mode: negotiation.mode, settings } });
  
  const title = useMemo(() => {
    if (isAiGame) return `${negotiation.mode} AI 대국 설정`;
    if (negotiation.rematchOfGameId) return `재대결 설정 (${negotiation.mode})`;
    return `대국 설정 (${negotiation.mode})`;
  }, [negotiation.mode, negotiation.rematchOfGameId, isAiGame]);

  const hasEnoughAP = currentUser.actionPoints.current >= actionPointCost;

  const renderButtons = () => {
    const baseButtonClasses = "flex-1";
    
    if (isAiGame) {
        return (
             <div className="flex justify-end gap-4">
                <Button onClick={onDecline} colorScheme="red" className={baseButtonClasses}>취소</Button>
                <Button onClick={onStartAiGame} colorScheme="green" className={baseButtonClasses} disabled={!hasEnoughAP}>
                    시작하기 {hasEnoughAP ? `(⚡${actionPointCost})` : `(⚡부족)`}
                </Button>
            </div>
        );
    }
    
    if (isCreatingDraft) {
      const isMixModeInvalid = negotiation.mode === GameMode.Mix && (!settings.mixedModes || settings.mixedModes.length < 2);
      return (
        <div className="flex justify-between items-center gap-4">
          <Button onClick={onDecline} colorScheme="red" className={baseButtonClasses}>취소</Button>
          <Button onClick={onSendChallenge} disabled={isMixModeInvalid || !hasEnoughAP} colorScheme="green" className={baseButtonClasses}>
            대국 신청 {hasEnoughAP ? `(⚡${actionPointCost})` : `(⚡부족)`}
          </Button>
        </div>
      );
    }

    if (isMyTurnToRespond) {
      return (
        <div className="flex justify-between items-center gap-4">
            <Button onClick={onDecline} colorScheme="red" className={baseButtonClasses}>거절</Button>
            <Button onClick={onPropose} disabled={!settingsHaveChanged} colorScheme="yellow" className={baseButtonClasses}>수정 제안</Button>
            <Button onClick={onAccept} disabled={settingsHaveChanged || !hasEnoughAP} colorScheme="green" className={baseButtonClasses}>
                수락 {hasEnoughAP ? `(⚡${actionPointCost})` : `(⚡부족)`}
            </Button>
        </div>
      );
    }
    return null;
  };
  
  const isReadOnly = isWaitingForOpponent || !iAmProposer;

  const getStatusText = () => {
    if (isAiGame) return `AI 대국 설정을 확인해주세요.`;
    if (isCreatingDraft) return `대국 설정을 확인하고 [대국 신청] 버튼을 누르세요.`;
    if (isMyTurnToRespond) return `상대방의 제안을 [수락] 또는 [수정 제안]하세요.`;
    if (isWaitingForOpponent) return `상대방(${opponent.nickname})의 응답을 기다리는 중...`;
    return '설정 확인 중...';
  };
  
  const Select: React.FC<{ value: any, onChange: (val: any) => void, children: React.ReactNode, disabled?: boolean }> = ({ value, onChange, children, disabled }) => (
      <select 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        disabled={disabled}
        className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
      >
          {children}
      </select>
  );
  
    const showBoardSize = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice].includes(mode);
    const showKomi = ![GameMode.Capture, GameMode.Omok, GameMode.Ttamok, GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief, GameMode.Base].includes(mode);
    const showTimeControls = ![GameMode.Alkkagi, GameMode.Curling, GameMode.Dice, GameMode.Thief].includes(mode);
    
    const showFischer = mode === GameMode.Speed || (mode === GameMode.Mix && !!settings.mixedModes?.includes(GameMode.Speed));
    
    const showCaptureTarget = mode === GameMode.Capture;
    const showTtamokCaptureTarget = mode === GameMode.Ttamok;
    const showOmokRules = mode === GameMode.Omok || mode === GameMode.Ttamok;
    const showBaseStones = mode === GameMode.Base;
    const showHiddenStones = mode === GameMode.Hidden;
    const showMissileCount = mode === GameMode.Missile;
    const showMixModeSelection = mode === GameMode.Mix;
    const showDiceGoSettings = mode === GameMode.Dice;
    const showAlkkagiSettings = mode === GameMode.Alkkagi;
    const showCurlingSettings = mode === GameMode.Curling;
    
    const isBaseInMix = negotiation.mode === GameMode.Mix && settings.mixedModes?.includes(GameMode.Base);
    const showAiPlayerColor = isAiGame && negotiation.mode !== GameMode.Base && !isBaseInMix;

    // The slider value will be 1-10.
    const [aiLevelSlider, setAiLevelSlider] = useState(1);
    const isCaptureGo = mode === GameMode.Capture;
    const isPlayfulAi = isAiGame && PLAYFUL_GAME_MODES.some(m => m.mode === mode);

    useEffect(() => {
        const difficulty = settings.aiDifficulty || 10; // This is 1-100
        setAiLevelSlider(Math.max(1, Math.min(10, Math.round(difficulty / 10))));
    }, [settings.aiDifficulty]);

    const handleAiLevelSliderChange = (value: number) => {
        setAiLevelSlider(value);
        handleSettingChange('aiDifficulty', value * 10);
    };

    const displayedAiLevel = useMemo(() => {
        if (isCaptureGo) {
            return captureAiLevelMap[aiLevelSlider - 1];
        }
        if (isStrategic) {
            return strategicAiDisplayMap[aiLevelSlider - 1];
        }
        // Playful AI
        return aiLevelSlider;
    }, [aiLevelSlider, isStrategic, isCaptureGo]);
    
    const autoEndTurnOptions = getAutoEndTurnOptions(settings.boardSize);


  return (
    <DraggableWindow title={title} windowId="negotiation" onClose={onDecline} initialWidth={600} closeOnOutsideClick={false} isTopmost={isTopmost}>
      <div onMouseDown={(e) => e.stopPropagation()} className="text-sm">
        <p className="text-center text-yellow-300 mb-4">{getStatusText()} <CountdownDisplay deadline={negotiation.deadline} /></p>

        <div className="flex flex-col gap-6">
            <div className="bg-gray-900/50 p-2 md:p-4 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 md:gap-4">
                    <Avatar userId={opponent.id} userName={opponent.nickname} avatarUrl={opponentAvatarUrl} borderUrl={opponentBorderUrl} size={48} />
                    <div className="flex-grow">
                        <h3 className="text-xl font-bold">{opponent.nickname}</h3>
                        <p className="text-sm text-gray-400">
                            {opponentStats.levelLabel} Lv.{opponentStats.level}
                        </p>
                    </div>
                    {!isAiGame && (
                        <div className="text-right text-sm">
                            <p className="font-semibold">{opponentStats.wins}승 {opponentStats.losses}패 ({opponentStats.winRate}%)</p>
                            <p className="text-gray-300">매너: {opponentStats.mannerScore}점</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3 max-h-[calc(60vh - 12rem)] overflow-y-auto pr-2">
                {isAiGame && isStrategic && (
                    <SettingRow label="AI 난이도">
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={aiLevelSlider}
                                onChange={(e) => handleAiLevelSliderChange(Number(e.target.value))}
                                disabled={isReadOnly}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="font-bold text-lg w-20 text-center">Lv.{displayedAiLevel}</span>
                        </div>
                    </SettingRow>
                )}

                {showBoardSize && (
                    <SettingRow label="판 크기">
                        <Select value={settings.boardSize} onChange={(v: string) => handleSettingChange('boardSize', parseInt(v, 10) as GameSettings['boardSize'])} disabled={isReadOnly}>
                            {(negotiation.mode === GameMode.Omok || negotiation.mode === GameMode.Ttamok ? OMOK_BOARD_SIZES : negotiation.mode === GameMode.Capture ? CAPTURE_BOARD_SIZES : negotiation.mode === GameMode.Speed ? SPEED_BOARD_SIZES : negotiation.mode === GameMode.Hidden ? HIDDEN_BOARD_SIZES : negotiation.mode === GameMode.Thief ? THIEF_BOARD_SIZES : negotiation.mode === GameMode.Missile ? MISSILE_BOARD_SIZES : BOARD_SIZES).map((size: number) => <option key={size} value={size}>{size}줄</option>)}
                        </Select>
                    </SettingRow>
                )}

                {isAiGame && isStrategic && (
                    <SettingRow label="자동 계가 턴수">
                        <Select value={settings.autoEndTurnCount || 0} onChange={(v: string) => handleSettingChange('autoEndTurnCount', parseInt(v, 10))} disabled={isReadOnly}>
                            <option value={0}>사용 안함</option>
                            {autoEndTurnOptions.map(turn => <option key={turn} value={turn}>{turn}수</option>)}
                        </Select>
                    </SettingRow>
                )}

                {showKomi && (
                    <SettingRow label="덤 (백)">
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                step="1" 
                                value={Math.floor(settings.komi)} 
                                onChange={e => handleSettingChange('komi', parseInt(e.target.value, 10) + 0.5)} 
                                disabled={isReadOnly} 
                                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5" 
                            />
                            <span className="font-bold text-lg text-gray-300 whitespace-nowrap">.5 집</span>
                        </div>
                    </SettingRow>
                )}

                {showAiPlayerColor && (
                    negotiation.mode === GameMode.Thief ? (
                        <SettingRow label="시작 역할">
                            <Select value={settings.player1Color} onChange={(v: string) => handleSettingChange('player1Color', parseInt(v, 10))} disabled={isReadOnly}>
                                <option value={Player.Black}>도둑(흑)</option>
                                <option value={Player.White}>경찰(백)</option>
                            </Select>
                        </SettingRow>
                    ) : (
                        <SettingRow label="내 돌 색">
                            <Select value={settings.player1Color} onChange={(v: string) => handleSettingChange('player1Color', parseInt(v, 10))} disabled={isReadOnly}>
                                <option value={Player.Black}>흑</option>
                                <option value={Player.White}>백</option>
                            </Select>
                        </SettingRow>
                    )
                )}

                {showTimeControls && (
                    showFischer ? (
                        <>
                            <SettingRow label="제한 시간">
                                <Select value={settings.timeLimit} onChange={(v: string) => handleSettingChange('timeLimit', parseInt(v))} disabled={isReadOnly}>
                                {SPEED_TIME_LIMITS.map((t: { value: number; label: string; }) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </Select>
                            </SettingRow>
                            <SettingRow label="초읽기 시간"> <p className="text-sm text-gray-300">{FISCHER_INCREMENT_SECONDS}초 (피셔 방식)</p> </SettingRow>
                        </>
                    ) : (
                        <>
                            <SettingRow label="제한 시간">
                                <Select value={settings.timeLimit} onChange={(v: string) => handleSettingChange('timeLimit', parseInt(v))} disabled={isReadOnly}>
                                    {TIME_LIMITS.map((t: { value: number; label: string; }) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </Select>
                            </SettingRow>
                            <SettingRow label="초읽기">
                                <div className="flex gap-2">
                                <Select value={settings.byoyomiTime} onChange={(v: string) => handleSettingChange('byoyomiTime', parseInt(v))} disabled={isReadOnly}>
                                        {BYOYOMI_TIMES.map((t: number) => <option key={t} value={t}>{t}초</option>)}
                                    </Select>
                                    <Select value={settings.byoyomiCount} onChange={(v: string) => handleSettingChange('byoyomiCount', parseInt(v))} disabled={isReadOnly}>
                                        {BYOYOMI_COUNTS.map((c: number) => <option key={c} value={c}>{c}회</option>)}
                                    </Select>
                                </div>
                            </SettingRow>
                        </>
                    )
                )}
                
                {showDiceGoSettings && (
                   <>
                    <SettingRow label="라운드 설정">
                        <Select value={settings.diceGoRounds ?? 3} onChange={(v: string) => handleSettingChange('diceGoRounds', parseInt(v, 10) as 1 | 2 | 3)} disabled={isReadOnly}>
                            {[1, 2, 3].map(r => <option key={r} value={r}>{r}라운드</option>)}
                        </Select>
                    </SettingRow>
                    <SettingRow label="홀수 아이템">
                       <Select value={settings.oddDiceCount ?? 1} onChange={(v: string) => handleSettingChange('oddDiceCount', parseInt(v, 10))} disabled={isReadOnly}>
                           {DICE_GO_ITEM_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                       </Select>
                   </SettingRow>
                   <SettingRow label="짝수 아이템">
                       <Select value={settings.evenDiceCount ?? 1} onChange={(v: string) => handleSettingChange('evenDiceCount', parseInt(v, 10))} disabled={isReadOnly}>
                           {DICE_GO_ITEM_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                       </Select>
                   </SettingRow>
                   </>
                )}

                {showCaptureTarget && (
                    <SettingRow label="따내기 목표">
                        <Select value={settings.captureTarget} onChange={(v: string) => handleSettingChange('captureTarget', parseInt(v))} disabled={isReadOnly}>
                            {CAPTURE_TARGETS.map((t: number) => <option key={t} value={t}>{t}개</option>)}
                        </Select>
                    </SettingRow>
                )}
                {showTtamokCaptureTarget && (
                    <SettingRow label="따내기 목표">
                        <Select value={settings.captureTarget} onChange={(v: string) => handleSettingChange('captureTarget', parseInt(v))} disabled={isReadOnly}>
                            {TTAMOK_CAPTURE_TARGETS.map((t: number) => <option key={t} value={t}>{t}개</option>)}
                        </Select>
                    </SettingRow>
                )}

                {showOmokRules && (
                    <>
                        <SettingRow label="쌍삼 금지"><input type="checkbox" checked={settings.has33Forbidden} onChange={e => handleSettingChange('has33Forbidden', e.target.checked)} disabled={isReadOnly} className="w-5 h-5" /></SettingRow>
                        <SettingRow label="장목 금지"><input type="checkbox" checked={settings.hasOverlineForbidden} onChange={e => handleSettingChange('hasOverlineForbidden', e.target.checked)} disabled={isReadOnly} className="w-5 h-5" /></SettingRow>
                    </>
                )}

                {showBaseStones && (
                    <SettingRow label="베이스돌 개수">
                        <Select value={settings.baseStones} onChange={(v: string) => handleSettingChange('baseStones', parseInt(v))} disabled={isReadOnly}>
                            {BASE_STONE_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                        </Select>
                    </SettingRow>
                )}

                {showHiddenStones && (
                    <>
                        <SettingRow label="히든돌 개수">
                            <Select value={settings.hiddenStoneCount} onChange={(v: string) => handleSettingChange('hiddenStoneCount', parseInt(v))} disabled={isReadOnly}>
                                {HIDDEN_STONE_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                            </Select>
                        </SettingRow>
                        <SettingRow label="스캔 개수">
                            <Select value={settings.scanCount} onChange={(v: string) => handleSettingChange('scanCount', parseInt(v))} disabled={isReadOnly}>
                            {SCAN_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                            </Select>
                        </SettingRow>
                    </>
                )}
                
                {showMissileCount && (
                    <SettingRow label="미사일 개수">
                        <Select value={settings.missileCount} onChange={(v: string) => handleSettingChange('missileCount', parseInt(v))} disabled={isReadOnly}>
                        {MISSILE_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                        </Select>
                    </SettingRow>
                )}

                {showMixModeSelection && (() => {
                    const isBaseSelected = settings.mixedModes?.includes(GameMode.Base);
                    const isCaptureSelected = settings.mixedModes?.includes(GameMode.Capture);
                    return (
                        <div className="col-span-2 pt-2 border-t border-gray-700">
                            <h3 className="font-semibold text-gray-300 mb-2">믹스룰 조합 (2개 이상 선택)</h3>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {SPECIAL_GAME_MODES.filter((m: { mode: GameMode }) => m.mode !== GameMode.Standard && m.mode !== GameMode.Mix).map((m: { mode: GameMode }) => {
                                    const isDisabledByConflict = 
                                        (m.mode === GameMode.Base && isCaptureSelected) ||
                                        (m.mode === GameMode.Capture && isBaseSelected);
                                    
                                    return (
                                        <label key={m.mode} className={`flex items-center gap-2 p-2 bg-gray-700/50 rounded-md ${isReadOnly || isDisabledByConflict ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                            <input 
                                                type="checkbox" 
                                                checked={settings.mixedModes?.includes(m.mode)} 
                                                onChange={e => handleMixedModeChange(m.mode, e.target.checked)} 
                                                disabled={isReadOnly || isDisabledByConflict} 
                                                className="w-4 h-4"
                                            />
                                            <span>{m.mode}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {settings.mixedModes?.includes(GameMode.Base) && (
                                <SettingRow label="베이스돌 개수" className="mt-4">
                                    <Select value={settings.baseStones} onChange={(v: string) => handleSettingChange('baseStones', parseInt(v))} disabled={isReadOnly}>
                                        {BASE_STONE_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                                    </Select>
                                </SettingRow>
                            )}
                            {settings.mixedModes?.includes(GameMode.Hidden) && (
                                <>
                                    <SettingRow label="히든돌 개수" className="mt-2">
                                        <Select value={settings.hiddenStoneCount} onChange={(v: string) => handleSettingChange('hiddenStoneCount', parseInt(v))} disabled={isReadOnly}>
                                            {HIDDEN_STONE_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                                        </Select>
                                    </SettingRow>
                                    <SettingRow label="스캔 개수" className="mt-2">
                                        <Select value={settings.scanCount} onChange={(v: string) => handleSettingChange('scanCount', parseInt(v))} disabled={isReadOnly}>
                                        {SCAN_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                                        </Select>
                                    </SettingRow>
                                </>
                            )}
                            {settings.mixedModes?.includes(GameMode.Missile) && (
                                <SettingRow label="미사일 개수" className="mt-2">
                                    <Select value={settings.missileCount} onChange={(v: string) => handleSettingChange('missileCount', parseInt(v))} disabled={isReadOnly}>
                                    {MISSILE_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                                    </Select>
                                </SettingRow>
                            )}
                            {settings.mixedModes?.includes(GameMode.Capture) && (
                                <SettingRow label="따내기 목표" className="mt-2">
                                    <Select value={settings.captureTarget} onChange={(v: string) => handleSettingChange('captureTarget', parseInt(v))} disabled={isReadOnly}>
                                        {CAPTURE_TARGETS.map((t: number) => <option key={t} value={t}>{t}개</option>)}
                                    </Select>
                                </SettingRow>
                            )}
                        </div>
                    );
                })()}

                {showAlkkagiSettings && (
                    <>
                        <SettingRow label="라운드">
                            <Select value={settings.alkkagiRounds} onChange={(v: string) => handleSettingChange('alkkagiRounds', parseInt(v) as 1 | 2 | 3)} disabled={isReadOnly}>
                                {ALKKAGI_ROUNDS.map((r: 1 | 2 | 3) => <option key={r} value={r}>{r}라운드</option>)}
                            </Select>
                        </SettingRow>
                        <SettingRow label="배치 방식">
                            <Select value={settings.alkkagiPlacementType} onChange={(v: string) => handleSettingChange('alkkagiPlacementType', v as AlkkagiPlacementType)} disabled={isReadOnly}>
                                {Object.values(AlkkagiPlacementType).map((type: AlkkagiPlacementType) => <option key={type} value={type}>{type}</option>)}
                            </Select>
                        </SettingRow>
                        <SettingRow label="배치 전장">
                            <Select value={settings.alkkagiLayout} onChange={(v: string) => handleSettingChange('alkkagiLayout', v as AlkkagiLayoutType)} disabled={isReadOnly}>
                                {Object.values(AlkkagiLayoutType).map((type: AlkkagiLayoutType) => <option key={type} value={type}>{type}</option>)}
                            </Select>
                        </SettingRow>
                        <SettingRow label="바둑돌 개수">
                            <Select value={settings.alkkagiStoneCount} onChange={(v: string) => handleSettingChange('alkkagiStoneCount', parseInt(v))} disabled={isReadOnly}>
                                {ALKKAGI_STONE_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                            </Select>
                        </SettingRow>
                        <SettingRow label="게이지 속도">
                            <Select value={settings.alkkagiGaugeSpeed} onChange={(v: string) => handleSettingChange('alkkagiGaugeSpeed', parseInt(v))} disabled={isReadOnly}>
                                {ALKKAGI_GAUGE_SPEEDS.map((s: {value: number, label: string}) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </Select>
                        </SettingRow>
                         <SettingRow label="슬로우 아이템">
                            <Select value={settings.alkkagiSlowItemCount} onChange={(v: string) => handleSettingChange('alkkagiSlowItemCount', parseInt(v))} disabled={isReadOnly}>
                                {ALKKAGI_ITEM_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                            </Select>
                        </SettingRow>
                         <SettingRow label="조준선 아이템">
                            <Select value={settings.alkkagiAimingLineItemCount} onChange={(v: string) => handleSettingChange('alkkagiAimingLineItemCount', parseInt(v))} disabled={isReadOnly}>
                                {ALKKAGI_ITEM_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                            </Select>
                        </SettingRow>
                    </>
                )}
                
                {showCurlingSettings && (
                    <>
                        <SettingRow label="라운드">
                            <Select value={settings.curlingRounds} onChange={(v: string) => handleSettingChange('curlingRounds', parseInt(v) as 1 | 2 | 3)} disabled={isReadOnly}>
                                {CURLING_ROUNDS.map((r: 1 | 2 | 3) => <option key={r} value={r}>{r}라운드</option>)}
                            </Select>
                        </SettingRow>
                        <SettingRow label="스톤 개수">
                            <Select value={settings.curlingStoneCount} onChange={(v: string) => handleSettingChange('curlingStoneCount', parseInt(v))} disabled={isReadOnly}>
                                {CURLING_STONE_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                            </Select>
                        </SettingRow>
                        <SettingRow label="게이지 속도">
                            <Select value={settings.curlingGaugeSpeed} onChange={(v: string) => handleSettingChange('curlingGaugeSpeed', parseInt(v))} disabled={isReadOnly}>
                                {CURLING_GAUGE_SPEEDS.map((s: {value: number, label: string}) => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </Select>
                        </SettingRow>
                        <SettingRow label="슬로우 아이템">
                            <Select value={settings.curlingSlowItemCount} onChange={(v: string) => handleSettingChange('curlingSlowItemCount', parseInt(v))} disabled={isReadOnly}>
                                {CURLING_ITEM_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                            </Select>
                        </SettingRow>
                         <SettingRow label="조준선 아이템">
                            <Select value={settings.curlingAimingLineItemCount} onChange={(v: string) => handleSettingChange('curlingAimingLineItemCount', parseInt(v))} disabled={isReadOnly}>
                                {CURLING_ITEM_COUNTS.map((c: number) => <option key={c} value={c}>{c}개</option>)}
                            </Select>
                        </SettingRow>
                    </>
                )}
            </div>
        </div>
        
        <div className="mt-6 border-t border-gray-700 pt-6">
             {renderButtons()}
        </div>
      </div>
    </DraggableWindow>
  );
};

export default React.memo(NegotiationModal);