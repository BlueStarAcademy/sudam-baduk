
import { LiveGameSession, UserWithStatus, ChatMessage, Negotiation, ServerAction } from "./index.js";

// Define setting types
export type Theme = 'black' | 'white' | 'blue' | 'sky' | 'green';
export type SoundCategory = 'stone' | 'notification' | 'item' | 'countdown' | 'turn';

export interface GraphicsSettings {
    theme: Theme;
    panelColor?: string;
    textColor?: string;
}

export interface SoundSettings {
    masterVolume: number;
    masterMuted: boolean;
    categoryMuted: Record<SoundCategory, boolean>;
}

export interface FeatureSettings {
    mobileConfirm: boolean;
    stonePreview: boolean;
    lastMoveMarker: boolean;
    questNotifications: boolean;
    chatNotifications: boolean;
}

export interface AppSettings {
    graphics: GraphicsSettings;
    sound: SoundSettings;
    features: FeatureSettings;
}

export interface GameProps {
    session: LiveGameSession;
    currentUser: UserWithStatus;
    waitingRoomChat: ChatMessage[];
    gameChat: ChatMessage[];
    isSpectator: boolean;
    onlineUsers: UserWithStatus[];
    negotiations: Negotiation[];
    activeNegotiation: Negotiation | null;
    onViewUser: (userId: string) => void;
    onAction: (action: ServerAction) => void;
}