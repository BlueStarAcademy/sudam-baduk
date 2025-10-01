import React, { useMemo } from 'react';
import { GameProps, Player, ServerAction, Point, GameStatus, GameMode } from '../../types/index.js';
import Button from '../Button.js';
import { useAppContext } from '../../hooks/useAppContext.js';

interface TowerChallengeControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {
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
    className?: string;
}> = ({ imgSrc, label, count, cost, onClick, disabled, title, className = '' }) => (
    <Button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`!p-1 flex flex-col items-center justify-center h-full w-20 aspect-square relative !rounded-lg !shadow-lg border-2 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed !bg-wood-pattern ${disabled ? 'border-gray-600' : 'border-red-700'} ${className}`}
        colorScheme="gray"
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
                {cost.includes('💎') ? <img src="/images/Zem.png" alt="다이아" className="w-3 h-3" /> : (cost !== '무료' && <img src="/images/Gold.png" alt="골드" className="w-3 h-3" />)}
                <span>{cost.replace('💎 ', '').replace('💰 ', '')}</span>
            </div>
        )}
    </Button>
);

const TowerChallengeControls: React.FC<TowerChallengeControlsProps> = ({ session, onAction, currentUser, pendingMove, onConfirmMove, onCancelMove, setConfirmModalType }) => {
    const { settings, isMobile } = useAppContext();
    const { id: gameId, gameStatus, moveHistory, floor, towerAddStonesUsed, towerChallengePlacementRefreshesUsed, towerItemPurchases } = session;
    
    // --- Hooks ---
    const opponentPlayerEnum = Player.White;
    const canScan = useMemo(() => {
        if (!session.hiddenMoves || !session.moveHistory) return false;
        return Object.entries(session.hiddenMoves).some(([moveIndexStr, isHidden]) => {
            if (!isHidden) return false;
            const move = session.moveHistory[parseInt(moveIndexStr)];
            if (!move || move.player !== opponentPlayerEnum) return false;
            const { x, y } = move;
            if (session.boardState[y]?.[x] !== opponentPlayerEnum) return false;
            const isPermanentlyRevealed = session.permanentlyRevealedStones?.some(p => p.x === x && p.y === y);
            return !isPermanentlyRevealed;
        });
    }, [session.hiddenMoves, session.moveHistory, session.boardState, session.permanentlyRevealedStones]);

    // --- Early returns after hooks ---
    if (isMobile && settings.features.mobileConfirm && pendingMove) {
        return (
            <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-center gap-4 w-full h-full border border-stone-700/50">
                <Button onClick={onCancelMove} colorScheme="red" className="!py-3 !px-6">취소</Button>
                <Button onClick={onConfirmMove} colorScheme="green" className="!py-3 !px-6 animate-pulse">착수</Button>
            </div>
        );
    }

    const isGameEnded = ['ended', 'no_contest'].includes(gameStatus);
    if (isGameEnded) return null;

    // --- Logic ---
    const handleResign = () => setConfirmModalType('resign');
    const isMyTurn = session.currentPlayer === Player.Black;
    const isGameStarted = moveHistory.length > 0;

    // --- Render Logic ---
    if (!isGameStarted) {
        const refreshesUsed = towerChallengePlacementRefreshesUsed || 0;
        const canRefresh = refreshesUsed < 5;
        const refreshCosts = [0, 50, 100, 200, 300];
        const nextRefreshCost = refreshCosts[refreshesUsed];
        const canAffordRefresh = currentUser.gold >= nextRefreshCost;
        
        const handleRefresh = () => {
            if (canRefresh && canAffordRefresh) {
                if (nextRefreshCost > 0) {
                    if (window.confirm(`${nextRefreshCost}골드가 소모됩니다. 새로고침 하시겠습니까?`)) {
                        onAction({ type: 'TOWER_CHALLENGE_REFRESH_PLACEMENT', payload: { gameId: session.id } });
                    }
                } else {
                    onAction({ type: 'TOWER_CHALLENGE_REFRESH_PLACEMENT', payload: { gameId: session.id } });
                }
            }
        };
        
        return (
            <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-around gap-1 w-full h-full border border-stone-700/50">
                 <ControlButton 
                    imgSrc="/images/button/reflesh.png" 
                    label="새로고침" 
                    count={`${5 - refreshesUsed}`}
                    cost={nextRefreshCost > 0 ? `💰 ${nextRefreshCost}` : '무료'}
                    onClick={handleRefresh} 
                    disabled={!canRefresh || !canAffordRefresh} 
                    title={!canAffordRefresh ? '골드가 부족합니다.' : `배치 새로고침 (${5-refreshesUsed}회 남음)`}
                />
                <ControlButton 
                    imgSrc="/images/button/giveup.png" 
                    label="기권" 
                    onClick={handleResign}
                />
            </div>
        );
    }

    if (floor && floor <= 20) {
        const addStonesUses = towerAddStonesUsed || 0;
        const addStonesCosts = [300, 500, 1000];
        const addStonesCost = addStonesCosts[addStonesUses];
        const canAffordAddStones = currentUser.gold >= addStonesCost;
        const canAddStones = addStonesUses < 3;
        
        const handleAddStones = () => {
            if (canAddStones && canAffordAddStones) {
                onAction({ type: 'TOWER_CHALLENGE_ADD_STONES', payload: { gameId: session.id } });
            }
        };
        
        return (
            <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-around gap-1 w-full h-full border border-stone-700/50">
                <ControlButton 
                    imgSrc="/images/button/addturn.png"
                    label="흑돌 추가"
                    cost={`💰 ${addStonesCost}`}
                    count={`${3 - addStonesUses}`}
                    onClick={handleAddStones}
                    disabled={!canAddStones || !canAffordAddStones} 
                    title={`골드를 소모하여 흑돌 제한을 3개 늘립니다. (${3-addStonesUses}회 남음)`}
                />
                <ControlButton 
                    imgSrc="/images/button/giveup.png" 
                    label="기권" 
                    onClick={handleResign}
                />
            </div>
        );
    }
    
    if (floor && floor > 20) {
        const myMissilesLeft = session.missiles_p1 ?? 0;
        const myHiddenUsed = session.hidden_stones_used_p1 ?? 0;
        const hiddenLeft = (session.settings.hiddenStoneCount || 0) - myHiddenUsed;
        const myScansLeft = session.scans_p1 ?? 0;
        
        const handleUseItem = (item: 'hidden' | 'scan' | 'missile') => {
            if(gameStatus !== 'playing' || !isMyTurn) return;
            const actionType = item === 'hidden' ? 'START_HIDDEN_PLACEMENT' : (item === 'scan' ? 'START_SCANNING' : 'START_MISSILE_SELECTION');
            onAction({ type: actionType, payload: { gameId } });
        };

        const handlePurchase = (itemType: 'missile' | 'hidden' | 'scan') => {
            const costs = { missile: 300, hidden: 500, scan: 100 };
            const cost = costs[itemType];
            if (currentUser.gold < cost) {
                alert('골드가 부족합니다.');
                return;
            }
            if (window.confirm(`골드 ${cost}개를 사용하여 ${itemType} 아이템을 구매하시겠습니까? (층당 1회)`)) {
                onAction({ type: 'TOWER_PURCHASE_ITEM', payload: { gameId, itemType } });
            }
        };

        const missilePurchased = !!towerItemPurchases?.missile;
        const hiddenPurchased = !!towerItemPurchases?.hidden;
        const scanPurchased = !!towerItemPurchases?.scan;

        const canPurchaseMissile = myMissilesLeft <= 0 && !missilePurchased;
        const canPurchaseHidden = hiddenLeft <= 0 && !hiddenPurchased;
        const canPurchaseScan = myScansLeft <= 0 && !scanPurchased;

        return (
            <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-around gap-1 w-full h-full border border-stone-700/50">
                <ControlButton 
                    imgSrc="/images/button/missile.png" 
                    label="미사일" 
                    count={myMissilesLeft > 0 ? myMissilesLeft : undefined}
                    cost={canPurchaseMissile ? '💰 300' : undefined}
                    onClick={() => canPurchaseMissile ? handlePurchase('missile') : handleUseItem('missile')} 
                    disabled={(!canPurchaseMissile && (myMissilesLeft <= 0 || !isMyTurn || gameStatus !== 'playing')) || (canPurchaseMissile && currentUser.gold < 300)}
                    title={canPurchaseMissile ? `미사일 ${session.settings.missileCount}개 구매` : '미사일 사용'}
                />
                <ControlButton 
                    imgSrc="/images/button/hidden.png" 
                    label="히든" 
                    count={hiddenLeft > 0 ? hiddenLeft : undefined}
                    cost={canPurchaseHidden ? '💰 500' : undefined}
                    onClick={() => canPurchaseHidden ? handlePurchase('hidden') : handleUseItem('hidden')} 
                    disabled={(!canPurchaseHidden && (hiddenLeft <= 0 || !isMyTurn || gameStatus !== 'playing')) || (canPurchaseHidden && currentUser.gold < 500)}
                    title={canPurchaseHidden ? `히든돌 ${session.settings.hiddenStoneCount}개 사용 횟수 추가` : '히든돌 사용'}
                />
                <ControlButton 
                    imgSrc="/images/button/scan.png" 
                    label="스캔" 
                    count={myScansLeft > 0 ? myScansLeft : undefined}
                    cost={canPurchaseScan ? '💰 100' : undefined}
                    onClick={() => canPurchaseScan ? handlePurchase('scan') : handleUseItem('scan')} 
                    disabled={(!canPurchaseScan && (myScansLeft <= 0 || !isMyTurn || gameStatus !== 'playing' || !canScan)) || (canPurchaseScan && currentUser.gold < 100)}
                    title={canPurchaseScan ? `스캔 ${session.settings.scanCount}개 구매` : '스캔 사용'}
                />
                 <ControlButton 
                    imgSrc="/images/button/giveup.png" 
                    label="기권" 
                    onClick={handleResign}
                />
            </div>
        );
    }
    
    return null;
};

export default TowerChallengeControls;