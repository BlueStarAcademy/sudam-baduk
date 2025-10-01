
import React, { useState } from 'react';
import AdminDashboard from './admin/AdminDashboard.js';
import UserManagementPanel from './admin/UserManagementPanel.js';
import MailSystemPanel from './admin/MailSystemPanel.js';
import ServerSettingsPanel from './admin/ServerSettingsPanel.js';
import { useAppContext } from '../hooks/useAppContext.js';
import AdminGuildManagementPanel from './admin/GuildManagementPanel.js';
// FIX: Use `import type` for interfaces to prevent type/value confusion.
import type { LiveGameSession, Guild as GuildType, AdminProps } from '../types/index.js';
import Button from './Button.js';

type AdminView = 'dashboard' | 'userManagement' | 'mailSystem' | 'serverSettings' | 'guildManagement';

interface GuildManagementListProps {
    guilds: Record<string, GuildType>;
    onBack: () => void;
    onSelectGuild: (guild: GuildType) => void;
}

const GuildManagementList: React.FC<GuildManagementListProps> = ({ guilds, onBack, onSelectGuild }) => {
    return (
        <div className="bg-primary text-primary">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">길드 관리</h1>
                <Button onClick={onBack} colorScheme="gray">&larr; 대시보드로</Button>
            </header>
            <div className="bg-panel border border-color p-4 rounded-lg shadow-lg">
                <ul className="space-y-2">
                    {Object.values(guilds).map((guild: GuildType) => (
                        <li key={guild.id} onClick={() => onSelectGuild(guild)} className="flex justify-between items-center p-2 bg-secondary/50 rounded-md cursor-pointer hover:bg-tertiary">
                            <div>
                                <p className="font-bold">{guild.name} <span className="text-sm text-tertiary">(Lv.{guild.level})</span></p>
                                <p className="text-xs text-secondary">{guild.members.length} members</p>
                            </div>
                            <Button className="!text-xs !py-1">관리</Button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const Admin: React.FC = () => {
    const [adminView, setAdminView] = useState<AdminView>('dashboard');
    const [selectedGuild, setSelectedGuild] = useState<GuildType | null>(null);
    const { currentUserWithStatus, allUsers, liveGames, adminLogs, gameModeAvailability, announcements, globalOverrideAnnouncement, announcementInterval, handlers, guilds } = useAppContext();

    const handleBack = () => {
        if (selectedGuild) {
            setSelectedGuild(null);
        } else if (adminView === 'dashboard') {
            window.location.hash = '#/profile';
        } else {
            setAdminView('dashboard');
        }
    };

    const adminProps: AdminProps = {
        currentUser: currentUserWithStatus!,
        allUsers,
        liveGames: Object.values(liveGames),
        adminLogs,
        onAction: handlers.handleAction,
        onBack: handleBack,
        gameModeAvailability,
        announcements,
        globalOverrideAnnouncement,
        announcementInterval,
        guilds,
    };

    const renderView = () => {
        switch (adminView) {
            case 'userManagement':
                return <UserManagementPanel {...adminProps} />;
            case 'mailSystem':
                return <MailSystemPanel {...adminProps} />;
            case 'serverSettings':
                return <ServerSettingsPanel {...adminProps} />;
            case 'guildManagement':
                if (selectedGuild) {
                    return <AdminGuildManagementPanel guild={selectedGuild} onBack={() => setSelectedGuild(null)} />;
                }
                return <GuildManagementList guilds={guilds} onBack={handleBack} onSelectGuild={setSelectedGuild} />;
            case 'dashboard':
            default:
                return <AdminDashboard onNavigate={setAdminView} onBackToProfile={handleBack} {...adminProps} />;
        }
    };

    return (
        <div className="p-4 lg:p-8">
            {renderView()}
        </div>
    );
};

export default Admin;
