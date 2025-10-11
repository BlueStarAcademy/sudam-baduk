
import * as db from '../db.js';
import { type User, type ServerAction, type HandleActionResult } from '../../types/index.js';
import { containsProfanity } from '../../profanity.js';

export const handlePresetAction = async (user: User, action: ServerAction): Promise<HandleActionResult> => {
    const { type, payload } = action;
    
    // FIX: Ensure presets exist and initialize if not
    if (!user.equipmentPresets) {
        user.equipmentPresets = [];
    }

    if (user.equipmentPresets.length < 5) {
        const presetsToAdd = 5 - user.equipmentPresets.length;
        for (let i = 0; i < presetsToAdd; i++) {
            user.equipmentPresets.push({ name: `프리셋 ${user.equipmentPresets.length + 1}`, equipment: {} });
        }
    }


    switch (type) {
        case 'SAVE_EQUIPMENT_PRESET': {
            const { presetIndex } = payload;
            if (presetIndex < 0 || presetIndex >= 5) return { error: '잘못된 프리셋입니다.' };

            user.equipmentPresets[presetIndex].equipment = { ...user.equipment };
            
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user, successMessage: '프리셋이 저장되었습니다.' } };
        }

        case 'LOAD_EQUIPMENT_PRESET': {
            const { presetIndex } = payload;
            if (presetIndex < 0 || presetIndex >= 5) return { error: '잘못된 프리셋입니다.' };

            const preset = user.equipmentPresets[presetIndex];
            if (!preset) return { error: '프리셋을 찾을 수 없습니다.' };

            // Unequip all current items
            user.inventory.forEach(item => {
                if (item.isEquipped) {
                    item.isEquipped = false;
                }
            });

            // Equip items from preset
            const newItemIdsToEquip = new Set(Object.values(preset.equipment));
            user.inventory.forEach(item => {
                if (newItemIdsToEquip.has(item.id)) {
                    item.isEquipped = true;
                }
            });
            
            user.equipment = { ...preset.equipment };
            
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user, successMessage: `'${preset.name}'을(를) 불러왔습니다.` } };
        }

        case 'RENAME_EQUIPMENT_PRESET': {
            const { presetIndex, newName } = payload;
            if (presetIndex < 0 || presetIndex >= 5) return { error: '잘못된 프리셋입니다.' };
            if (!newName || newName.trim().length < 1 || newName.trim().length > 10) {
                return { error: '프리셋 이름은 1-10자여야 합니다.' };
            }
            if (containsProfanity(newName)) {
                return { error: '프리셋 이름에 부적절한 단어가 포함되어 있습니다.' };
            }
            
            user.equipmentPresets[presetIndex].name = newName.trim();
            
            await db.updateUser(user);
            return { clientResponse: { updatedUser: user } };
        }
    }
    return { error: '알 수 없는 프리셋 액션입니다.' };
};
