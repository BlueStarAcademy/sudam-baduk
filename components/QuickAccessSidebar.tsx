import React, { useMemo } from 'react';
import { useAppContext } from '.././hooks/useAppContext.js';
import { GuildMember, GuildMemberRole } from '.././types/index.js';
import { isSameDayKST } from '.././utils/timeUtils.js';
import { GUILD_CHECK_IN_MILESTONE_REWARDS } from '.././constants/index.js';

interface QuickAccessSidebarProps {
    mobile?: boolean;
    compact?: boolean;
    showOnlyWhenQuestCompleted?: boolean;
    fillHeight?: boolean;
}

const QuickAccessSidebar: React.FC<QuickAccessSidebarProps> = ({ mobile = false, compact = false, showOnlyWhenQuestCompleted = false, fillHeight = true }) => {
    const { handlers, unreadMailCount, hasClaimableQuest, currentUserWithStatus, guilds } = useAppContext();
    
    if (showOnlyWhenQuestCompleted && !hasClaimableQuest) {
        return null;
    }

    const hasUnreadMail = unreadMailCount > 0;

    const guildNotification = useMemo(() => {
        if (!currentUserWithStatus?.guildId) return false;
        const myGuild = guilds[currentUserWithStatus.guildId];
        if (!myGuild) return false;
        const myMemberInfo = myGuild.members.find(m => m.userId === currentUserWithStatus.id);
        
        // Check for pending applicants
        if (myMemberInfo && (myMemberInfo.role === 'master' || myMemberInfo.role === 'vice')) {
            if ((myGuild.applicants?.length ?? 0) > 0) {
                return true;
            }
        }

        // Check for claimable check-in rewards
        const now = Date.now();
        const myCheckInTimestamp = myGuild.checkIns ? myGuild.checkIns[currentUserWithStatus.id] : undefined;
        const hasCheckedInToday = myGuild.checkIns && isSameDayKST(myCheckInTimestamp, now);

        if (hasCheckedInToday) {
            const todaysCheckIns = Object.values(myGuild.checkIns || {}).filter(ts => isSameDayKST(ts, now)).length;
            const hasClaimableMilestone = GUILD_CHECK_IN_MILESTONE_REWARDS.some((milestone: { count: number; reward: { guildCoins: number; }; }, index: number) => {
                const isAchieved = todaysCheckIns >= milestone.count;
                const isClaimed = myGuild.dailyCheckInRewardsClaimed?.some((c: { userId: string; milestoneIndex: number; }) => c.userId === currentUserWithStatus.id && c.milestoneIndex === index);
                return isAchieved && !isClaimed;
            });
            if (hasClaimableMilestone) return true;
        }
        
        return false;
    }, [currentUserWithStatus, guilds]);

    const allButtons = [
        { label: '퀘스트', iconUrl: '/images/quickmenu/quest.png', handler: handlers.openQuests, disabled: false, notification: hasClaimableQuest },
        { label: '우편함', iconUrl: '/images/quickmenu/mail.png', handler: handlers.openMailbox, disabled: false, notification: hasUnreadMail, count: unreadMailCount },
        { label: '기보', iconUrl: '/images/quickmenu/gibo.png', handler: () => alert('기보 기능은 현재 준비 중입니다.'), disabled: false, notification: false },
        { label: '상점', iconUrl: '/images/quickmenu/store.png', handler: () => handlers.openShop(), disabled: false, notification: false },
        { label: '길드', iconUrl: '/images/quickmenu/guild.png', handler: () => window.location.hash = '#/guild', disabled: false, notification: guildNotification },
        { label: '가방', iconUrl: '/images/quickmenu/bag.png', handler: () => handlers.openInventory(), disabled: false, notification: false },

    ];
    
    const containerClass = mobile 
        ? "flex justify-around items-center gap-2"
        : `bg-gray-800/50 rounded-lg p-${compact ? 1 : 2} flex flex-col justify-around gap-${compact ? 1 : 2} ${fillHeight ? 'h-full' : ''}`;
    
    const buttonClass = mobile
        ? "flex flex-col items-center justify-center p-1 rounded-md w-14 h-14 bg-gray-700/50 hover:bg-gray-600/50"
        : `flex flex-col items-center justify-center p-1 rounded-lg w-full bg-gray-700/50 hover:bg-gray-600/50`;
    
    const iconSize = mobile ? "w-6 h-6 object-contain" : compact ? "w-7 h-7 object-contain" : "w-8 h-8 object-contain";
    const labelSize = mobile ? "text-[10px] mt-1" : compact ? "text-[10px] mt-1" : "text-xs mt-1";
    
    const notificationDotClass = mobile
        ? "absolute top-1 right-1 bg-red-500 rounded-full w-2.5 h-2.5 border-2 border-gray-800"
        : `absolute top-1 right-1 bg-red-500 rounded-full w-2.5 h-2.5 border-2 ${compact ? 'border-gray-800' : 'border-gray-800/50'}`;
    
    const notificationCountClass = mobile
        ? "absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-gray-800"
        : `absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full ${compact ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center border-2 ${compact ? 'border-gray-800' : 'border-gray-800/50'}`;


    const renderButton = (btn: typeof allButtons[0]) => (
        <button
            key={btn.label}
            onClick={btn.handler}
            disabled={btn.disabled}
            className={`relative flex-1 ${buttonClass} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            title={btn.label}
        >
            <img src={btn.iconUrl} alt={btn.label} className={iconSize} />
            <span className={labelSize}>{btn.label}</span>
            {btn.notification && (
                (btn as any).count && (btn as any).count > 0 ? (
                    <span className={notificationCountClass}>
                        {(btn as any).count > 9 ? '9+' : (btn as any).count}
                    </span>
                ) : (
                    <span className={notificationDotClass}></span>
                )
            )}
        </button>
    );

    return (
        <div className={containerClass}>
            {allButtons.map(renderButton)}
        </div>
    );
};

export default QuickAccessSidebar;