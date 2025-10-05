import React, { useMemo, useCallback } from 'react';
import { GameProps, Player, ServerAction, SinglePlayerLevel, Point, GameStatus } from '../../types/index.js';
import Button from '../Button.js';
import { SINGLE_PLAYER_STAGES } from '../../constants/singlePlayerConstants.js';
import { useAppContext } from '../../hooks/useAppContext.js';

interface SinglePlayerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {
    pendingMove: Point | null;
    onConfirmMove: () => void;
    onCancelMove: () => void;
    setConfirmModalType: (type: 'resign' | null) => void;
}

const ControlButton: React.FC<{
    imgSrc: string;
    label: string;
    count?: string | number;
    cost?: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
}> = ({ imgSrc, label, count, cost, onClick, disabled, title }) => (
    <Button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`!p-1 flex flex-col items-center justify-center h-full w-20 aspect-square relative !rounded-lg !shadow-lg border-2 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed !bg-wood-pattern ${disabled ? 'border-gray-600' : 'border-yellow-600'}`}
        colorScheme="gray" // use gray as base, apply custom bg
    >
        <div className="flex-1 flex flex-col items-center justify-center">
            <img src={imgSrc} alt={label} className="w-8 h-8" />
            <span className="text-sm font-semibold mt-1 text-white" style={{ textShadow: '1px 1px 2px black' }}>{label}</span>
        </div>
        {count !== undefined && (
             <span className="absolute top-0.5 right-0.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-gray-400">
                {count}
            </span>
        )}
        {cost && (
            <div className="flex-shrink-0 text-xs text-yellow-300 flex items-center justify-center gap-0.5">
                {cost !== '무료' && <img src="/images/Gold.png" alt="골드" className="w-3 h-3" />}
                <span>{cost}</span>
            </div>
        )}
    </Button>
);

const SinglePlayerControls: React.FC<SinglePlayerControlsProps> = ({ session, onAction, currentUser, pendingMove, onConfirmMove, onCancelMove, setConfirmModalType }) => {
    const { handlers, settings, isMobile } = useAppContext();
    const { id: gameId, gameStatus, moveHistory, singlePlayerPlacementRefreshesUsed } = session;
    const isWinner = session.winner === Player.Black;

    if (gameStatus === 'ended' || gameStatus === 'no_contest') {
        const currentStageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === session.stageId);
        const nextStage = SINGLE_PLAYER_STAGES[currentStageIndex + 1];

        const canTryNext = useMemo(() => {
            if (!isWinner || !nextStage) return false;
            return (currentUser.singlePlayerProgress ?? 0) > currentStageIndex;
        }, [isWinner, nextStage, currentUser.singlePlayerProgress, currentStageIndex]);

        const handleRetry = () => {
            onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: session.stageId! } });
        };

        const handleNextStage = () => {
            if (canTryNext) {
                onAction({ type: 'START_SINGLE_PLAYER_GAME', payload: { stageId: nextStage.id } });
            }
        };

        const handleExitToLobby = () => {
            handlers.setPostGameRedirect('#/singleplayer');
            handlers.handleAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        };

        return (
             <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-center gap-2 w-full border border-stone-700/50">
                <Button onClick={handleExitToLobby} colorScheme="gray" className="flex-1 !text-sm">로비로</Button>
                <Button onClick={handleRetry} colorScheme="yellow" className="flex-1 !text-sm">재도전</Button>
                <Button onClick={handleNextStage} colorScheme="accent" disabled={!canTryNext} className="flex-1 !text-sm">
                    다음 단계{nextStage ? `: ${nextStage.name.replace('스테이지 ', '')}` : ''}
                </Button>
            </div>
        );
    }
    
    // In-game controls
    const refreshesUsed = singlePlayerPlacementRefreshesUsed || 0;
    const canRefresh = moveHistory.length === 0 && refreshesUsed < 5;
    const costs = [0, 50, 100, 200, 300];
    const nextCost = costs[refreshesUsed];
    const canAfford = currentUser.gold >= nextCost;
    
    const handleRefresh = () => {
        if (canRefresh && canAfford) {
            if (nextCost > 0) {
                if (window.confirm(`${nextCost}골드가 소모됩니다. 새로고침 하시겠습니까?`)) {
                    onAction({ type: 'SINGLE_PLAYER_REFRESH_PLACEMENT', payload: { gameId: session.id } });
                }
            } else {
                onAction({ type: 'SINGLE_PLAYER_REFRESH_PLACEMENT', payload: { gameId: session.id } });
            }
        }
    };
    
    const isMyTurn = session.currentPlayer === Player.Black;

    // Item logic
    const { isHiddenMode, isMissileMode } = useMemo(() => {
        const stageInfo = SINGLE_PLAYER_STAGES.find(s => s.id === session.stageId);
        return {
            isHiddenMode: stageInfo?.gameType === 'hidden' || stageInfo?.hiddenStoneCount,
            isMissileMode: stageInfo?.gameType === 'missile' || stageInfo?.missileCount,
        };
    }, [session.stageId]);

    if (isMobile && settings.features.mobileConfirm && pendingMove && onConfirmMove && onCancelMove) {
        return (
            <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-center gap-4 w-full h-full border border-stone-700/50">
                <Button onClick={onCancelMove} colorScheme="red" className="!py-3 !px-6">취소</Button>
                <Button onClick={onConfirmMove} colorScheme="green" className="!py-3 !px-6 animate-pulse">착수</Button>
            </div>
        );
    }

    return (
        <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-around gap-1 w-full h-full border border-stone-700/50">
            {canRefresh && (
                 <ControlButton 
                    imgSrc="/images/button/reflesh.png" 
                    label="새로고침" 
                    count={`${5 - refreshesUsed}`}
                    cost={nextCost > 0 ? `${nextCost}` : '무료'}
                    onClick={handleRefresh} 
                    disabled={!canRefresh || !canAfford} 
                    title={!canAfford ? '골드가 부족합니다.' : `판 새로고침 (${5-refreshesUsed}회 남음)`}
                />
            )}
            <ControlButton 
                imgSrc="/images/button/giveup.png" 
                label="기권" 
                onClick={() => setConfirmModalType('resign')} 
            />
        </div>
    );
};
export default SinglePlayerControls;
