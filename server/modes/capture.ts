import { LiveGameSession, Player, ServerAction, User, HandleActionResult, GameStatus, WinReason } from '../../types/index.js';
import { transitionToPlaying } from './shared.js';
import { endGame } from '../summaryService.js';

export const initializeCapture = (game: LiveGameSession, now: number) => {
    if (game.isAiGame) {
        // Set player colors for AI games, which was missing and causing games to get stuck.
        const humanPlayerColor = game.settings.player1Color || Player.Black;
        if (humanPlayerColor === Player.Black) {
            game.blackPlayerId = game.player1.id;
            game.whitePlayerId = game.player2.id;
        } else {
            game.whitePlayerId = game.player1.id;
            game.blackPlayerId = game.player2.id;
        }

        // Skips bidding for AI games. Both players get the same target.
        const target = game.settings.captureTarget || 20;
        game.effectiveCaptureTargets = {
            [Player.None]: 0,
            [Player.Black]: target,
            [Player.White]: target,
        };
        
        transitionToPlaying(game, now);
    } else {
        // For PvP, start the bidding process.
        const p1Id = game.player1.id;
        const p2Id = game.player2.id;
        game.gameStatus = GameStatus.CaptureBidding;
        game.bids = { [p1Id]: null, [p2Id]: null };
        game.biddingRound = 1;
        game.captureBidDeadline = now + 30000;
    }
};

export const updateCaptureState = (game: LiveGameSession, now: number) => {
    const p1Id = game.player1.id;
    const p2Id = game.player2.id;
    
    switch (game.gameStatus) {
        case GameStatus.CaptureBidding: {
            const bothHaveBid = game.bids?.[p1Id] != null && game.bids?.[p2Id] != null;
            const deadlinePassedBid = game.captureBidDeadline && now > game.captureBidDeadline;

            if (bothHaveBid || deadlinePassedBid) {
                if (deadlinePassedBid) {
                    if (game.bids![p1Id] == null) game.bids![p1Id] = 1;
                    if (game.bids![p2Id] == null) game.bids![p2Id] = 1;
                }

                const p1Bid = game.bids![p1Id]!;
                const p2Bid = game.bids![p2Id]!;
                const baseTarget = game.settings.captureTarget || 20;

                if (p1Bid !== p2Bid) {
                    const winnerId = p1Bid > p2Bid ? p1Id : p2Id;
                    const loserId = winnerId === p1Id ? p2Id : p1Id;
                    const winnerBid = Math.max(p1Bid, p2Bid);
                    
                    game.blackPlayerId = winnerId;
                    game.whitePlayerId = loserId;
                    
                    game.effectiveCaptureTargets = {
                        [Player.None]: 0,
                        [Player.Black]: baseTarget + winnerBid,
                        [Player.White]: baseTarget,
                    };
                    
                    game.gameStatus = GameStatus.CaptureReveal;
                    game.revealEndTime = now + 10000;
                } else { // Tie
                    if (game.biddingRound === 1) {
                        game.gameStatus = GameStatus.CaptureReveal;
                        game.revealEndTime = now + 3000;
                    } else {
                        const winnerId = Math.random() < 0.5 ? p1Id : p2Id;
                        const loserId = winnerId === p1Id ? p2Id : p1Id;

                        game.blackPlayerId = winnerId;
                        game.whitePlayerId = loserId;

                        game.effectiveCaptureTargets = {
                            [Player.None]: 0,
                            [Player.Black]: baseTarget + p1Bid,
                            [Player.White]: baseTarget,
                        };

                        game.gameStatus = GameStatus.CaptureTiebreaker;
                        game.revealEndTime = now + 3000;
                    }
                }
            }
            break;
        }
        case GameStatus.CaptureReveal:
        case GameStatus.CaptureTiebreaker: {
            const bothConfirmedCapture = game.preGameConfirmations?.[p1Id] && game.preGameConfirmations?.[p2Id];
            if (game.revealEndTime && (now > game.revealEndTime || bothConfirmedCapture)) {
                
                const p1Bid = game.bids?.[p1Id];
                const p2Bid = game.bids?.[p2Id];
                if (game.biddingRound === 1 && p1Bid === p2Bid) { // This is the condition for re-bidding.
                    game.biddingRound = 2;
                    game.bids = { [p1Id]: null, [p2Id]: null };
                    game.captureBidDeadline = now + 30000;
                    game.gameStatus = GameStatus.CaptureBidding;
                    game.preGameConfirmations = {};
                    game.revealEndTime = undefined;
                    return;
                }
                
                transitionToPlaying(game, now);
                game.bids = undefined; 
                game.biddingRound = undefined;
            }
            break;
        }
    }
};

export const handleCaptureAction = (game: LiveGameSession, action: ServerAction & { userId: string }, user: User): HandleActionResult | null => {
    const { type, payload } = action;

    switch (type) {
        case 'UPDATE_CAPTURE_BID':
            if (game.gameStatus !== GameStatus.CaptureBidding || game.bids?.[user.id]) return { error: "Cannot bid now." };
            if (!game.bids) game.bids = {};
            game.bids[user.id] = payload.bid;
            return {};
        case 'CONFIRM_CAPTURE_REVEAL':
            if (![GameStatus.CaptureReveal, GameStatus.CaptureTiebreaker].includes(game.gameStatus)) return { error: "Not in confirmation phase." };
            if (!game.preGameConfirmations) game.preGameConfirmations = {};
            game.preGameConfirmations[user.id] = true;
            return {};
    }
    return null;
};