import React, { useMemo } from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import { SINGLE_PLAYER_STAGES } from '../../constants.js';

interface SinglePlayerControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {}

const SinglePlayerControls: React.FC<SinglePlayerControlsProps> = ({ session, onAction, currentUser }) => {
    
    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        const currentStageIndex = SINGLE_PLAYER_STAGES.findIndex(s => s.id === session.stageId);
        const nextStage = SINGLE_PLAYER_STAGES[currentStageIndex + 1];
        const isWinner = session.winner === Player.Black;

        const canTryNext = useMemo(() => {
            if (!isWinner || !nextStage) return false;
            // The progress is the index of the *next* stage to be played.
            // So if you just beat stage 5 (index 4), your progress is 5.
            // You can try stage 6 (index 5) if your progress is >= 5.
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
            sessionStorage.setItem('postGameRedirect', '#/singleplayer');
            onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
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
    
    const refreshesUsed = session.singlePlayerPlacementRefreshesUsed || 0;
    const canRefresh = session.moveHistory.length === 0 && refreshesUsed < 5;
    const costs = [0, 50, 100, 200, 300];
    const nextCost = costs[refreshesUsed] || 0;
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

    const handleForfeit = () => {
        if (window.confirm('현재 스테이지를 포기하고 로비로 돌아가시겠습니까?')) {
            sessionStorage.setItem('postGameRedirect', '#/singleplayer');
            onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        }
    };

    return (
        <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-between gap-4 w-full h-full border border-stone-700/50">
            <Button onClick={handleForfeit} colorScheme="red" className="!text-sm">
                포기하기
            </Button>
            <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400">
                    다음 비용: 💰{canRefresh ? nextCost : '-'}
                </span>
                <Button onClick={handleRefresh} colorScheme="accent" className="!text-sm" disabled={!canRefresh || !canAfford} title={!canAfford ? '골드가 부족합니다.' : ''}>
                    배치 새로고침 ({5 - refreshesUsed}/5)
                </Button>
            </div>
        </div>
    );
};

export default SinglePlayerControls;