

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Header from './Header';
import { useAppContext } from '../hooks/useAppContext';
import Router from './Router';
import NegotiationModal from './NegotiationModal';
import InventoryModal from './InventoryModal';
import MailboxModal from './MailboxModal';
import QuestsModal from './QuestsModal';
import ShopModal from './ShopModal';
import UserProfileModal from './UserProfileModal';
import InfoModal from './InfoModal';
import DisassemblyResultModal from './DisassemblyResultModal';
import StatAllocationModal from './StatAllocationModal';
import EnhancementModal from './EnhancementModal';
import ItemDetailModal from './ItemDetailModal';
import ProfileEditModal from './ProfileEditModal';
import ItemObtainedModal from './ItemObtainedModal';
import BulkItemObtainedModal from './BulkItemObtainedModal';
import EncyclopediaModal from './modals/EncyclopediaModal';
import PastRankingsModal from './modals/PastRankingsModal';
import AdminModerationModal from './AdminModerationModal';
import RewardSummaryModal from './RewardSummaryModal';
import { preloadImages, ALL_IMAGE_URLS } from '../services/assetService';
import CraftingResultModal from './CraftingResultModal';
import { audioService } from '../services/audioService';
import SettingsModal from './SettingsModal';
import ClaimAllSummaryModal from './ClaimAllSummaryModal';
import MbtiInfoModal from './MbtiInfoModal';
import SynthesisResultModal from './SynthesisResultModal';
import TowerRankingRewardsModal from './TowerRankingRewardsModal';
import LevelUpModal from './LevelUpModal';
import ActionPointQuizModal from './modals/ActionPointQuizModal';
import { UserStatus } from '../types/index';
import GuildEffectsModal from './guild/GuildEffectsModal';
import GuildBossBattleResultModal from './guild/GuildBossBattleResultModal';
import EquipmentEffectsModal from './EquipmentEffectsModal';
import PresetModal from './PresetModal';

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

const App: React.FC = () => {
    const {
        currentUser,
        currentUserWithStatus,
        currentRoute,
        error,
        successToast,
        activeNegotiation,
        modals,
        showExitToast,
        enhancementResult,
        enhancementOutcome,
        handlers,
        onlineUsers,
        guilds,
    } = useAppContext();
    
    const [isPreloading, setIsPreloading] = useState(true);
    
    useEffect(() => {
        const preventContextMenu = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }
            e.preventDefault();
        };

        document.addEventListener('contextmenu', preventContextMenu);
        return () => {
            document.removeEventListener('contextmenu', preventContextMenu);
        };
    }, []);


    useEffect(() => {
        const initAudio = () => {
            audioService.initialize();
            document.removeEventListener('pointerdown', initAudio);
        };
        document.addEventListener('pointerdown', initAudio);

        return () => {
            document.removeEventListener('pointerdown', initAudio);
        };
    }, []);

    useEffect(() => {
        if (currentUser) {
            preloadImages(ALL_IMAGE_URLS).then(() => {
                setIsPreloading(false);
            });
        } else {
            setIsPreloading(false);
        }
    }, [currentUser]);

    const topmostModalId = modals.activeModalIds.length > 0 ? modals.activeModalIds[modals.activeModalIds.length - 1] : null;
    
    const isGameView = currentRoute.view === 'game';

    return (
        <div className="font-sans bg-primary text-primary h-full flex flex-col">
            {isPreloading && (
                <div className="fixed inset-0 bg-tertiary z-[100] flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
                    <p className="mt-4 text-primary">에셋 로딩 중...</p>
                </div>
            )}
            {error && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down">
                    <div className="bg-danger border-2 border-red-500 rounded-lg shadow-2xl p-4 text-white font-bold text-center">{error}</div>
                </div>
            )}
            {successToast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down">
                    <div className="bg-success border-2 border-green-500 rounded-lg shadow-2xl p-4 text-white font-bold text-center">{successToast}</div>
                </div>
            )}
            {enhancementResult && !modals.enhancingItem && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down">
                    <div className={`${enhancementResult.success ? 'bg-accent border-accent' : 'bg-danger border-red-500'} border-2 rounded-lg shadow-2xl p-4 text-white font-bold text-center`}>{enhancementResult.message}</div>
                </div>
            )}
            {showExitToast && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50 animate-slide-down-fast">
                    <div className="bg-primary border-2 border-color rounded-lg shadow-2xl p-3 text-primary font-semibold text-center">한번 더 뒤로가기를 하면 로그아웃 됩니다.</div>
                </div>
            )}
            
            {currentUser && !isGameView && <Header />}
            
            <main className="flex-1 flex flex-col min-h-0">
                <Router />
            </main>
            
            {/* Render modals only when a user is logged in */}
            {currentUserWithStatus && (
                <>
                    {modals.levelUpInfo && <LevelUpModal levelUpInfo={modals.levelUpInfo} onClose={handlers.closeLevelUpModal} />}
                    {modals.isSettingsModalOpen && <SettingsModal onClose={handlers.closeSettingsModal} isTopmost={topmostModalId === 'settings'} />}
                    {modals.isInventoryOpen && <InventoryModal currentUser={currentUserWithStatus} onClose={handlers.closeInventory} onAction={handlers.handleAction} onStartEnhance={handlers.openEnhancingItem} enhancementAnimationTarget={modals.enhancementAnimationTarget} onAnimationComplete={handlers.clearEnhancementAnimation} isTopmost={topmostModalId === 'inventory'} initialTab={modals.inventoryInitialTab} />}
                    {modals.isMailboxOpen && <MailboxModal currentUser={currentUserWithStatus} onClose={handlers.closeMailbox} onAction={handlers.handleAction} isTopmost={topmostModalId === 'mailbox'} />}
                    {modals.isQuestsOpen && <QuestsModal currentUser={currentUserWithStatus} onClose={handlers.closeQuests} onAction={handlers.handleAction} isTopmost={topmostModalId === 'quests'} />}
                    {modals.rewardSummary && <RewardSummaryModal summary={modals.rewardSummary} onClose={handlers.closeRewardSummary} isTopmost={topmostModalId === 'rewardSummary'} />}
                    {modals.isClaimAllSummaryOpen && modals.claimAllSummary && <ClaimAllSummaryModal summary={modals.claimAllSummary} onClose={handlers.closeClaimAllSummary} isTopmost={topmostModalId === 'claimAllSummary'} />}
                    {modals.isShopOpen && <ShopModal initialTab={modals.shopInitialTab} currentUser={currentUserWithStatus} onClose={handlers.closeShop} onAction={handlers.handleAction} onStartQuiz={handlers.openActionPointQuiz} isTopmost={topmostModalId === 'shop'} />}
                    {modals.isActionPointQuizOpen && <ActionPointQuizModal onClose={handlers.closeActionPointQuiz} onAction={handlers.handleAction} isTopmost={topmostModalId === 'actionPointQuiz'} />}
                    
                    {modals.lastUsedItemResult && modals.lastUsedItemResult.length === 1 && <ItemObtainedModal item={modals.lastUsedItemResult[0]} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} />}
                    {modals.lastUsedItemResult && modals.lastUsedItemResult.length > 1 && <BulkItemObtainedModal items={modals.lastUsedItemResult} onClose={handlers.closeItemObtained} isTopmost={topmostModalId === 'itemObtained'} />}

                    {modals.disassemblyResult && <DisassemblyResultModal result={modals.disassemblyResult} onClose={handlers.closeDisassemblyResult} isTopmost={topmostModalId === 'disassemblyResult'} />}
                    {modals.craftResult && <CraftingResultModal result={modals.craftResult} onClose={handlers.closeCraftResult} isTopmost={topmostModalId === 'craftResult'} />}
                    {modals.synthesisResult && <SynthesisResultModal result={modals.synthesisResult} onClose={handlers.closeSynthesisResult} isTopmost={topmostModalId === 'synthesisResult'} />}
                    {modals.viewingUser && <UserProfileModal user={modals.viewingUser} onClose={handlers.closeViewingUser} onViewItem={handlers.openViewingItem} isTopmost={topmostModalId === 'viewingUser'} />}
                    {modals.isInfoModalOpen && <InfoModal onClose={handlers.closeInfoModal} isTopmost={topmostModalId === 'infoModal'} />}
                    {modals.isEncyclopediaOpen && <EncyclopediaModal onClose={handlers.closeEncyclopedia} isTopmost={topmostModalId === 'encyclopedia'} />}
                    {modals.isStatAllocationModalOpen && <StatAllocationModal currentUser={currentUserWithStatus} onClose={handlers.closeStatAllocationModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'statAllocation'} />}
                    {modals.isProfileEditModalOpen && <ProfileEditModal currentUser={currentUserWithStatus} onClose={handlers.closeProfileEditModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'profileEdit'} />}
                    {modals.pastRankingsInfo && <PastRankingsModal info={modals.pastRankingsInfo} onClose={handlers.closePastRankings} isTopmost={topmostModalId === 'pastRankings'} />}
                    {modals.moderatingUser && <AdminModerationModal user={modals.moderatingUser} currentUser={currentUserWithStatus} onClose={handlers.closeModerationModal} onAction={handlers.handleAction} isTopmost={topmostModalId === 'moderatingUser'} />}
                    {modals.viewingItem && <ItemDetailModal item={modals.viewingItem.item} isOwnedByCurrentUser={modals.viewingItem.isOwnedByCurrentUser} onClose={handlers.closeViewingItem} onStartEnhance={handlers.openEnhancementFromDetail} isTopmost={topmostModalId === 'viewingItem'} />}
                    {modals.enhancingItem && <EnhancementModal item={modals.enhancingItem} currentUser={currentUserWithStatus} onClose={handlers.closeEnhancementModal} onAction={handlers.handleAction} enhancementOutcome={enhancementOutcome} onOutcomeConfirm={handlers.clearEnhancementOutcome} isTopmost={topmostModalId === 'enhancingItem'} />}
                    {modals.isTowerRewardInfoOpen && <TowerRankingRewardsModal onClose={handlers.closeTowerRewardInfoModal} isTopmost={topmostModalId === 'towerRewardInfo'} />}
                    {modals.isGuildEffectsModalOpen && currentUserWithStatus.guildId && guilds[currentUserWithStatus.guildId] && (
                        <GuildEffectsModal
                            guild={guilds[currentUserWithStatus.guildId]}
                            onClose={handlers.closeGuildEffectsModal}
                            isTopmost={topmostModalId === 'guildEffects'}
                        />
                    )}
                    {modals.guildBossBattleResult && <GuildBossBattleResultModal result={{ ...modals.guildBossBattleResult, bossName: modals.guildBossBattleResult.bossName }} onClose={handlers.closeGuildBossBattleResultModal} isTopmost={topmostModalId === 'guildBossBattleResult'} />}
                    {activeNegotiation && <NegotiationModal negotiation={activeNegotiation} currentUser={currentUserWithStatus} onAction={handlers.handleAction} onlineUsers={onlineUsers} isTopmost={topmostModalId === 'negotiation'} />}
                    {modals.isEquipmentEffectsModalOpen && <EquipmentEffectsModal user={currentUserWithStatus} guild={currentUserWithStatus.guildId ? guilds[currentUserWithStatus.guildId] ?? null : null} onClose={handlers.closeEquipmentEffectsModal} />}
                    {modals.isPresetModalOpen && <PresetModal user={currentUserWithStatus} onAction={handlers.handleAction} onClose={handlers.closePresetModal} />}
                </>
            )}
        </div>
    );
};

export default App;