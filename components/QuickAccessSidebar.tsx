import React from 'react';
import { useAppContext } from '../hooks/useAppContext';

interface QuickAccessSidebarProps {
  mobile?: boolean;
  fillHeight?: boolean;
  compact?: boolean;
}

const QuickAccessSidebar: React.FC<QuickAccessSidebarProps> = ({ mobile, fillHeight, compact }) => {
  const { handlers, hasClaimableQuest, hasFullMissionReward, currentUserWithStatus } = useAppContext();

  const hasMail = currentUserWithStatus && currentUserWithStatus.mail.some(m => !m.isRead);
  const hasNotification = hasClaimableQuest || hasFullMissionReward;

  const buttons = [
    { label: '퀘스트', icon: '/images/quickmenu/quest.png', action: handlers.openQuests, notification: hasNotification },
    { label: '우편함', icon: '/images/quickmenu/mail.png', action: handlers.openMailbox, notification: hasMail },
    { label: '길드', icon: '/images/quickmenu/guild.png', action: () => window.location.hash = '#/guild' },
    { label: '상점', icon: '/images/quickmenu/store.png', action: () => handlers.openShop('package') },
    { label: '대장간', icon: '/images/quickmenu/enhance.png', action: handlers.openBlacksmith },
    { label: '가방', icon: '/images/quickmenu/bag.png', action: handlers.openInventory },
  ];

  const containerClasses = mobile 
    ? 'flex justify-around items-center' 
    : `flex flex-col ${fillHeight ? 'h-full justify-around' : 'gap-3'}`;

  return (
    <div className={`bg-panel panel-glow text-on-panel rounded-lg p-2 w-20 ${containerClasses}`}>
      {buttons.map(({ label, icon, action, notification }) => (
        <button
          key={label}
          onClick={() => action()}
          className="relative group transition-transform hover:scale-110"
          title={label}
        >
          <div className="w-12 h-12 bg-secondary rounded-md flex items-center justify-center border-2 border-yellow-500/50 group-hover:border-yellow-400 transition-all p-1 relative">
            <img src={icon} alt={label} className="w-full h-full object-cover rounded-sm" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/30 text-center">
                <span className="text-xs text-white font-semibold">{label}</span>
            </div>
          </div>
          {notification && (
            <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-primary"></div>
          )}
        </button>
      ))}
    </div>
  );
};

export default QuickAccessSidebar;