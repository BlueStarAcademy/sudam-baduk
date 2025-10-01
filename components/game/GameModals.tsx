import React from 'react';
import { GameProps, GameStatus, Negotiation } from '../../types.js';
import GameSummaryModal from '../GameSummaryModal.js';
import NigiriModal from '../NigiriModal.js';
import CaptureBidModal from '../CaptureBidModal.js';
import CaptureTiebreakerModal from '../CaptureTiebreakerModal.js';
import RPSMinigame from '../RPSMinigame.js';
import ThiefRoleSelection from '../ThiefRoleSelection.js';
import ThiefRoleConfirmedModal from '../ThiefRoleConfirmedModal.js';
import TurnPreferenceSelection from '../TurnPreferenceSelection.js';
import NoContestModal from '../NoContestModal.js';
import ThiefRoundSummary from '../ThiefRoundSummary.js';
import CurlingRoundSummary from '../CurlingRoundSummary.js';
import Button from '../Button.js';
import DiceRoundSummary from '../DiceRoundSummary.js';
import BasePlacementModal from '../BasePlacementModal.js';
import KomiBiddingPanel from '../KomiBiddingPanel.js';
import AlkkagiPlacementModal from '../AlkkagiPlacementModal.js';
import NegotiationModal from '../NegotiationModal.js';
import DiceGoTurnSelectionModal from '../DiceGoTurnSelectionModal.js';
import BaseStartConfirmationModal from '../BaseStartConfirmationModal.js';
import AlkkagiRoundSummary from '../AlkkagiRoundSummary.js';
import DiceGoStartConfirmationModal from '../DiceGoStartConfirmationModal.js';
import CurlingStartConfirmationModal from '../CurlingStartConfirmationModal.js';
import AlkkagiStartConfirmationModal from '../AlkkagiStartConfirmationModal.js';
import SinglePlayerSummaryModal from '../SinglePlayerSummaryModal.js';
import TowerChallengeSummaryModal from '../TowerChallengeSummaryModal.js';

interface GameModalsProps extends GameProps {
    confirmModalType: 'resign' | null;
    onHideConfirmModal: () => void;
    showResultModal: boolean;
    onCloseResults: (cleanupAndRedirect?: boolean) => void;
}

const GameModals: React.FC<GameModalsProps> = (props) => {
    const { session, currentUser, onAction, confirmModalType, onHideConfirmModal, showResultModal, onCloseResults, isSpectator, activeNegotiation, onlineUsers, onViewUser } = props;
    const { gameStatus, mode, id: gameId } = session;

    const renderModals = () => {
        if (activeNegotiation) {
            return <NegotiationModal negotiation={activeNegotiation} currentUser={currentUser} onAction={onAction} onlineUsers={onlineUsers} />;
        }
        
        if (session.isTowerChallenge && showResultModal) {
            return <TowerChallengeSummaryModal session={session} currentUser={currentUser} onAction={onAction} onClose={onCloseResults} />;
        }

        if (session.isSinglePlayer && showResultModal) {
            return <SinglePlayerSummaryModal session={session} currentUser={currentUser} onAction={onAction} onClose={onCloseResults} />;
        }
        
        const playerOnlyStates: GameStatus[] = [
            GameStatus.NigiriChoosing, GameStatus.NigiriGuessing,
            GameStatus.BasePlacement,
            GameStatus.KomiBidding,
            GameStatus.CaptureBidding,
            GameStatus.DiceRps, GameStatus.ThiefRps, GameStatus.AlkkagiRps, GameStatus.CurlingRps, GameStatus.OmokRps, GameStatus.TtamokRps,
            GameStatus.TurnPreferenceSelection,
            GameStatus.ThiefRoleSelection,
            GameStatus.AlkkagiSimultaneousPlacement,
            GameStatus.DiceTurnRolling,
        ];

        if (isSpectator && playerOnlyStates.includes(gameStatus)) {
            return null;
        }
        
        const rpsStates: GameStatus[] = [GameStatus.DiceRps, GameStatus.DiceRpsReveal, GameStatus.ThiefRps, GameStatus.ThiefRpsReveal, GameStatus.AlkkagiRps, GameStatus.AlkkagiRpsReveal, GameStatus.CurlingRps, GameStatus.CurlingRpsReveal, GameStatus.OmokRps, GameStatus.OmokRpsReveal, GameStatus.TtamokRps, GameStatus.TtamokRpsReveal];
        
        if (gameStatus === GameStatus.ThiefRoleSelection) return <ThiefRoleSelection session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.DiceTurnRolling || gameStatus === GameStatus.DiceTurnRollingAnimating || gameStatus === GameStatus.DiceTurnChoice) return <DiceGoTurnSelectionModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.DiceStartConfirmation) return <DiceGoStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.TurnPreferenceSelection) return <TurnPreferenceSelection session={session} currentUser={currentUser} onAction={onAction} tiebreaker={session.turnSelectionTiebreaker} />;
        if ([GameStatus.NigiriChoosing, GameStatus.NigiriGuessing, GameStatus.NigiriReveal].includes(gameStatus)) return <NigiriModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.CaptureBidding) return <CaptureBidModal session={session} currentUser={currentUser} onAction={onAction} />;
        if ([GameStatus.CaptureTiebreaker, GameStatus.CaptureReveal].includes(gameStatus)) return <CaptureTiebreakerModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.BasePlacement) return <BasePlacementModal session={session} currentUser={currentUser} onAction={onAction} />;
        if ([GameStatus.KomiBidding, GameStatus.KomiBidReveal].includes(gameStatus)) return <KomiBiddingPanel session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.BaseGameStartConfirmation) return <BaseStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (rpsStates.includes(gameStatus)) return <RPSMinigame session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.AlkkagiStartConfirmation) return <AlkkagiStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.CurlingStartConfirmation) return <CurlingStartConfirmationModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.ThiefRoleConfirmed) return <ThiefRoleConfirmedModal session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.ThiefRoundEnd) return <ThiefRoundSummary session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.CurlingRoundEnd) return <CurlingRoundSummary session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.AlkkagiRoundEnd) return <AlkkagiRoundSummary session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.DiceRoundEnd) return <DiceRoundSummary session={session} currentUser={currentUser} onAction={onAction} />;
        if (gameStatus === GameStatus.AlkkagiSimultaneousPlacement) return <AlkkagiPlacementModal session={session} currentUser={currentUser} />;
        
        if (showResultModal) {
            if (gameStatus === GameStatus.Ended) return <GameSummaryModal session={session} currentUser={currentUser} onConfirm={() => onCloseResults()} />;
            if (gameStatus === GameStatus.NoContest) return <NoContestModal session={session} currentUser={currentUser} onConfirm={() => onCloseResults()} />
        }
        return null;
    };

    const confirmModalContent = {
        resign: {
            title: "기권 확인",
            message: "정말로 기권하시겠습니까? 기권패로 처리되며 즉시 대기실로 이동합니다.",
            confirmText: "기권",
            onConfirm: () => onAction({ type: 'RESIGN_GAME', payload: { gameId, andLeave: true } }),
        },
    };

    const content = confirmModalType ? confirmModalContent[confirmModalType] : null;

    return (
        <>
            {renderModals()}
            {content && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6 border border-gray-700">
                        <h2 className="text-xl font-bold text-center mb-4">{content.title}</h2>
                        <p className="text-center text-gray-300 mb-6">{content.message}</p>
                        <div className="flex gap-4 mt-4">
                            <Button onClick={onHideConfirmModal} colorScheme="gray" className="w-full">취소</Button>
                            <Button onClick={() => { onHideConfirmModal(); content.onConfirm(); }} colorScheme="red" className="w-full">{content.confirmText}</Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default GameModals;