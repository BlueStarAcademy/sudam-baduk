import React, { useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { Theme, SoundCategory } from '../types/index.js';
import ToggleSwitch from './ui/ToggleSwitch.js';
import Slider from './ui/Slider.js';
import ColorSwatch from './ui/ColorSwatch.js';

interface SettingsModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

type SettingsTab = 'graphics' | 'sound' | 'features' | 'account';

const THEMES: { id: Theme; name: string; colors: string[] }[] = [
    { id: 'black', name: '슬레이트', colors: ['#0f172a', '#1e293b', '#e2e8f0', '#eab308'] },
    { id: 'white', name: '라이트', colors: ['#f8fafc', '#f1f5f9', '#0f172a', '#ca8a04'] },
    { id: 'sky', name: '데이브레이크', colors: ['#f0f9ff', '#e0f2fe', '#1e3a8a', '#f97316'] },
    { id: 'blue', name: '파스텔 블루', colors: ['#eff6ff', '#dbeafe', '#1e40af', '#3b82f6'] },
    { id: 'green', name: '파스텔 그린', colors: ['#f0fdf4', '#dcfce7', '#14532d', '#d946ef'] },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, isTopmost }) => {
    // FIX: Destructure handlers from useAppContext and use them to update settings.
    const { settings, handlers } = useAppContext();
    const { updateTheme, updateSoundSetting, updateFeatureSetting } = handlers;
    const [activeTab, setActiveTab] = useState<SettingsTab>('graphics');
    
    const tabs: { id: SettingsTab; label: string }[] = [
        { id: 'graphics', label: '그래픽' },
        { id: 'sound', label: '사운드' },
        { id: 'features', label: '기능' },
        { id: 'account', label: '계정' },
    ];

    const soundCategories: { key: SoundCategory, label: string }[] = [
        { key: 'stone', label: '착수/충돌/낙하 소리' },
        { key: 'notification', label: '획득/레벨업 알림' },
        { key: 'item', label: '아이템 사용 소리' },
        { key: 'countdown', label: '초읽기/카운트다운 소리' },
        { key: 'turn', label: '내 턴 알림 소리' },
    ];

    const AccountSettingsPanel = () => {
        const [currentPassword, setCurrentPassword] = useState('');
        const [newPassword, setNewPassword] = useState('');
        const [confirmPassword, setConfirmPassword] = useState('');
        const [passwordError, setPasswordError] = useState('');
        const [passwordSuccess, setPasswordSuccess] = useState('');

        const handleChangePassword = async () => {
            setPasswordError('');
            setPasswordSuccess('');
            if (!currentPassword || !newPassword || !confirmPassword) {
                setPasswordError('모든 필드를 입력해주세요.');
                return;
            }
            if (newPassword.length < 4) {
                setPasswordError('새 비밀번호는 4자 이상이어야 합니다.');
                return;
            }
            if (newPassword !== confirmPassword) {
                setPasswordError('새 비밀번호가 일치하지 않습니다.');
                return;
            }
            
            const result = await handlers.handleAction({
                type: 'CHANGE_PASSWORD',
                payload: { currentPassword, newPassword }
            });

            if (result && result.success) {
                 setPasswordSuccess('비밀번호가 성공적으로 변경되었습니다.');
                 setCurrentPassword('');
                 setNewPassword('');
                 setConfirmPassword('');
            } else if (result && result.error) {
                setPasswordError(result.error);
            }
        };

        const handleDeleteAccount = () => {
            if (window.confirm('정말로 회원 탈퇴를 하시겠습니까? 탈퇴 시 일주일간 같은 주민등록번호로 재가입이 불가능합니다. 모든 데이터는 영구적으로 삭제되며 이 작업은 되돌릴 수 없습니다.')) {
                handlers.handleAction({ type: 'DELETE_ACCOUNT', payload: undefined });
                onClose();
            }
        };

        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-text-secondary mb-3">비밀번호 변경</h3>
                    <div className="space-y-3 max-w-sm">
                        <input type="password" placeholder="현재 비밀번호" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-tertiary border border-color rounded-md p-2 text-primary" />
                        <input type="password" placeholder="새 비밀번호" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-tertiary border border-color rounded-md p-2 text-primary" />
                        <input type="password" placeholder="새 비밀번호 확인" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-tertiary border border-color rounded-md p-2 text-primary" />
                        {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                        {passwordSuccess && <p className="text-xs text-green-400">{passwordSuccess}</p>}
                        <Button onClick={handleChangePassword} colorScheme="blue" className="w-full">변경하기</Button>
                    </div>
                </div>
                <div className="pt-6 border-t border-color">
                    <h3 className="text-lg font-semibold text-danger mb-3">회원 탈퇴</h3>
                    <p className="text-sm text-text-secondary mb-3">계정을 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
                    <Button onClick={handleDeleteAccount} colorScheme="red">계정 삭제</Button>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'graphics':
                return (
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold text-text-secondary">UI 테마</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                {THEMES.map(theme => (
                                    <label key={theme.id} className="flex items-center p-3 bg-tertiary/50 rounded-lg cursor-pointer border-2 border-transparent has-[:checked]:border-accent has-[:checked]:ring-2 has-[:checked]:ring-accent">
                                        <input
                                            type="radio"
                                            name="theme"
                                            value={theme.id}
                                            checked={settings.graphics.theme === theme.id}
                                            onChange={() => updateTheme(theme.id)}
                                            className="w-5 h-5 text-accent bg-secondary border-color focus:ring-accent"
                                        />
                                        <span className="ml-3 text-text-primary">{theme.name}</span>
                                        <div className="ml-auto flex -space-x-2">
                                            {theme.colors.map((color, i) => (
                                                <div key={i} style={{ backgroundColor: color }} className="w-6 h-6 rounded-full border-2 border-primary"></div>
                                            ))}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 'sound':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-text-secondary mb-2">마스터 볼륨</h3>
                            <div className="flex items-center gap-4">
                                <span className="w-12 text-center font-mono text-text-primary text-lg">{(settings.sound.masterVolume * 10).toFixed(0)}</span>
                                <Slider 
                                    min={0} 
                                    max={1} 
                                    step={0.1}
                                    value={settings.sound.masterVolume} 
                                    onChange={(v) => updateSoundSetting('masterVolume', v)}
                                    disabled={settings.sound.masterMuted}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-text-secondary">효과음 전체</h3>
                            <ToggleSwitch
                                checked={!settings.sound.masterMuted}
                                onChange={(checked) => updateSoundSetting('masterMuted', !checked)}
                            />
                        </div>
                        <div className="space-y-3 pt-4 border-t border-color">
                             <h3 className="text-lg font-semibold text-text-secondary mb-2">효과음 세부 조절</h3>
                             {soundCategories.map(({key, label}) => (
                                <div key={key} className="flex items-center justify-between">
                                    <span className="text-text-secondary">{label}</span>
                                    <ToggleSwitch
                                        checked={!settings.sound.categoryMuted[key]}
                                        onChange={(checked) => updateSoundSetting('categoryMuted', {...settings.sound.categoryMuted, [key]: !checked})}
                                        disabled={settings.sound.masterMuted}
                                    />
                                </div>
                             ))}
                        </div>
                    </div>
                );
            case 'features':
                return (
                     <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-text-secondary mb-4">게임 플레이</h3>
                        <div className="flex items-center justify-between">
                            <span className="text-text-secondary">모바일 착점 시 [착수] 버튼 생성</span>
                            <ToggleSwitch
                                checked={settings.features.mobileConfirm}
                                onChange={(checked) => updateFeatureSetting('mobileConfirm', checked)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-text-secondary">돌 미리보기 (마우스 호버)</span>
                            <ToggleSwitch
                                checked={settings.features.stonePreview}
                                onChange={(checked) => updateFeatureSetting('stonePreview', checked)}
                            />
                        </div>
                         <div className="flex items-center justify-between">
                            <span className="text-text-secondary">마지막 놓은 자리 표시</span>
                            <ToggleSwitch
                                checked={settings.features.lastMoveMarker}
                                onChange={(checked) => updateFeatureSetting('lastMoveMarker', checked)}
                            />
                        </div>
                        <h3 className="text-lg font-semibold text-text-secondary mb-4 pt-4 border-t border-color">알림</h3>
                         <div className="flex items-center justify-between">
                            <span className="text-text-secondary">퀘스트 완료 알림</span>
                            <ToggleSwitch
                                checked={settings.features.questNotifications}
                                onChange={(checked) => updateFeatureSetting('questNotifications', checked)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-text-secondary">채팅 내용 알림 (빨간 점)</span>
                            <ToggleSwitch
                                checked={settings.features.chatNotifications}
                                onChange={(checked) => updateFeatureSetting('chatNotifications', checked)}
                            />
                        </div>
                    </div>
                );
            case 'account':
                return <AccountSettingsPanel />;
        }
    };
    
    return (
        <DraggableWindow title="설정" onClose={onClose} windowId="settings" initialWidth={600} isTopmost={isTopmost}>
            <div className="h-[calc(var(--vh,1vh)*60)] flex flex-col">
                <div className="flex bg-tertiary/70 p-1 rounded-lg mb-4 flex-shrink-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === tab.id ? 'bg-accent' : 'text-tertiary hover:bg-secondary/50'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex-grow overflow-y-auto pr-2 p-2">
                    {renderContent()}
                </div>
                 <div className="flex justify-end gap-4 mt-4 pt-4 border-t border-color flex-shrink-0">
                    <Button onClick={onClose} colorScheme="gray">닫기</Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SettingsModal;