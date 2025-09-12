import React from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import { TOWER_STAGES } from '../../constants/towerChallengeConstants.js';

interface TowerChallengeControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {}

const TowerChallengeControls: React.FC<TowerChallengeControlsProps> = ({ session, onAction, currentUser }) => {
    
    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        const currentStage = TOWER_STAGES.find(s => s.id === session.stageId);
        const currentStageIndex = TOWER_STAGES.findIndex(s => s.id === session.stageId);
        const nextStage = TOWER_STAGES[currentStageIndex + 1];
        const isWinner = session.winner === Player.Black;

        const canTryNext = React.useMemo(() => {
            if (!isWinner || !nextStage || !currentStage) return false;
            return (currentUser.towerProgress?.highestFloor ?? 0) >= currentStage.floor!;
        }, [isWinner, nextStage, currentStage, currentUser.towerProgress]);

        const handleRetry = () => {
            if (currentStage) {
                onAction({ type: 'START_TOWER_CHALLENGE_GAME', payload: { floor: currentStage.floor! } });
            }
        };

        const handleNextStage = () => {
            if (canTryNext) {
                onAction({ type: 'START_TOWER_CHALLENGE_GAME', payload: { floor: nextStage.floor! } });
            }
        };

        const handleExitToLobby = () => {
            sessionStorage.setItem('postGameRedirect', '#/towerchallenge');
            onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        };

        return (
             <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-center gap-2 w-full border border-stone-700/50">
                <Button onClick={handleExitToLobby} colorScheme="gray" className="flex-1 !text-sm">로비로</Button>
                <Button onClick={handleRetry} colorScheme="yellow" className="flex-1 !text-sm">재도전</Button>
                <Button onClick={handleNextStage} colorScheme="accent" disabled={!canTryNext} className="flex-1 !text-sm">
                    다음 단계{nextStage ? `: ${nextStage.floor}층` : ''}
                </Button>
            </div>
        );
    }
    
    const { id: gameId, moveHistory, towerChallengePlacementRefreshesUsed, addedStonesItemUsed } = session;

    const refreshesUsed = towerChallengePlacementRefreshesUsed || 0;
    const canRefresh = moveHistory.length === 0 && refreshesUsed < 5;
    const costs = [0, 50, 100, 200, 300];
    const nextCost = costs[refreshesUsed] || 0;
    const canAffordRefresh = currentUser.gold >= nextCost;

    const handleRefresh = () => {
        if (canRefresh && canAffordRefresh) {
            if (nextCost > 0) {
                if (window.confirm(`${nextCost}골드가 소모됩니다. 새로고침 하시겠습니까?`)) {
                    onAction({ type: 'TOWER_CHALLENGE_REFRESH_PLACEMENT', payload: { gameId } });
                }
            } else {
                onAction({ type: 'TOWER_CHALLENGE_REFRESH_PLACEMENT', payload: { gameId } });
            }
        }
    };

    const addStonesCost = 300;
    const canAffordAddStones = currentUser.gold >= addStonesCost;
    const canAddStones = !addedStonesItemUsed;

    const handleAddStones = () => {
        if (canAddStones && canAffordAddStones) {
            if (window.confirm(`300골드를 사용하여 남은 흑돌을 3개 추가하시겠습니까? (게임당 1회)`)) {
                onAction({ type: 'TOWER_CHALLENGE_ADD_STONES', payload: { gameId } });
            }
        }
    };
    
    const handleForfeit = () => {
        if (window.confirm('현재 도전을 포기하고 로비로 돌아가시겠습니까?')) {
            sessionStorage.setItem('postGameRedirect', '#/towerchallenge');
            onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        }
    };
    
    const buttonClasses = "!text-xs !py-1";

    return (
        <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-between gap-1 w-full h-full border border-stone-700/50">
            <Button onClick={handleForfeit} colorScheme="red" className={buttonClasses}>포기하기</Button>
            
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-stone-400 text-center">다음 비용:<br/>💰{canRefresh ? nextCost : '-'}</span>
                <Button onClick={handleRefresh} colorScheme="accent" className={buttonClasses} disabled={!canRefresh || !canAffordRefresh} title={!canAffordRefresh ? '골드가 부족합니다.' : ''}>
                    배치 새로고침 ({5 - refreshesUsed}/5)
                </Button>
            </div>
             <Button onClick={handleAddStones} colorScheme="green" className={buttonClasses} disabled={!canAddStones || !canAffordAddStones} title={!canAddStones ? '이미 사용했습니다.' : !canAffordAddStones ? '골드가 부족합니다.' : ''}>
                흑돌 +3 (💰{addStonesCost})
            </Button>
        </div>
    );
};

export default TowerChallengeControls;
