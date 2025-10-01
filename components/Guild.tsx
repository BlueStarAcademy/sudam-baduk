import React, { useMemo } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import GuildLobby from './guild/GuildLobby.js';
// FIX: Changed to named import as GuildDashboard is not a default export.
import { GuildDashboard } from './guild/GuildDashboard.js';
import type { Guild as GuildType } from '../types/index.js';

const Guild: React.FC = () => {
    // Fetched `guildDonationAnimation` from useAppContext to pass to GuildDashboard.
    const { currentUserWithStatus, guilds, guildDonationAnimation } = useAppContext();

    const myGuild = useMemo(() => {
        if (!currentUserWithStatus?.guildId) return null;
        return guilds[currentUserWithStatus.guildId];
    }, [currentUserWithStatus?.guildId, guilds]);
    
    if (!currentUserWithStatus) {
        return <div className="flex items-center justify-center h-full">사용자 정보를 불러오는 중...</div>;
    }
    
    if (!currentUserWithStatus.guildId) {
        return <GuildLobby />;
    }

    if (!myGuild) {
        // This prevents GuildDashboard from unmounting during brief state inconsistencies
        return <div className="flex items-center justify-center h-full">길드 정보 로딩 중...</div>;
    }

    // Pass the required `guildDonationAnimation` prop to GuildDashboard.
    return <GuildDashboard key={myGuild.id} guild={myGuild} guildDonationAnimation={guildDonationAnimation} />;
};

export default Guild;