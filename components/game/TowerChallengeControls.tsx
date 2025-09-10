import React, { useMemo } from 'react';
import { GameProps, Player } from '../../types.js';
import Button from '../Button.js';
import { TOWER_STAGES } from '../../constants.js';

interface TowerChallengeControlsProps extends Pick<GameProps, 'session' | 'onAction' | 'currentUser'> {}

const TowerChallengeControls: React.FC<TowerChallengeControlsProps> = ({ session, onAction, currentUser }) => {
    
    if (session.gameStatus === 'ended' || session.gameStatus === 'no_contest') {
        const currentStage = TOWER_STAGES.find(s => s.id === session.stageId);
        const currentStageIndex = TOWER_STAGES.findIndex(s => s.id === session.stageId);
        const nextStage = TOWER_STAGES[currentStageIndex + 1];
        const isWinner = session.winner === Player.Black;

        const canTryNext = useMemo(() => {
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
    
    const handleForfeit = () => {
        if (window.confirm('현재 도전을 포기하고 로비로 돌아가시겠습니까?')) {
            sessionStorage.setItem('postGameRedirect', '#/towerchallenge');
            onAction({ type: 'LEAVE_AI_GAME', payload: { gameId: session.id } });
        }
    };

    return (
        <div className="bg-stone-800/60 backdrop-blur-sm rounded-lg p-2 flex items-center justify-center gap-4 w-full h-full border border-stone-700/50">
            <Button onClick={handleForfeit} colorScheme="red" className="w-full !text-sm">
                포기하기
            </Button>
        </div>
    );
};

export default TowerChallengeControls;