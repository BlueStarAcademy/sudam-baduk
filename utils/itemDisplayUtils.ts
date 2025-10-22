
import { ItemGrade } from '../types';

export const gradeStyles: Record<ItemGrade, { bg: string, text: string, shadow: string, name: string, background: string }> = {
    [ItemGrade.Normal]: { bg: 'bg-gray-700', text: 'text-white', shadow: 'shadow-gray-900/50', name: '일반', background: '/images/equipments/normalbgi.png' },
    [ItemGrade.Uncommon]: { bg: 'bg-green-700', text: 'text-green-200', shadow: 'shadow-green-500/50', name: '고급', background: '/images/equipments/uncommonbgi.png' },
    [ItemGrade.Rare]: { bg: 'bg-blue-700', text: 'text-blue-200', shadow: 'shadow-blue-500/50', name: '희귀', background: '/images/equipments/rarebgi.png' },
    [ItemGrade.Epic]: { bg: 'bg-purple-700', text: 'text-purple-200', shadow: 'shadow-purple-500/50', name: '에픽', background: '/images/equipments/epicbgi.png' },
    [ItemGrade.Legendary]: { bg: 'bg-red-800', text: 'text-red-200', shadow: 'shadow-red-500/50', name: '전설', background: '/images/equipments/legendarybgi.png' },
    [ItemGrade.Mythic]: { bg: 'bg-orange-700', text: 'text-orange-200', shadow: 'shadow-orange-500/50', name: '신화', background: '/images/equipments/mythicbgi.png' },
};



export const getStarDisplayInfo = (stars: number): { text: string; colorClass: string; starImage: string; numberColor: string; } => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect", starImage: '/images/star-rainbow.png', numberColor: 'text-white' };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-blue-400", starImage: '/images/star-blue.png', numberColor: 'text-blue-300' };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400", starImage: '/images/star-gold.png', numberColor: 'text-yellow-300' };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white", starImage: '/images/star-white.png', numberColor: 'text-white' };
    }
    return { text: "", colorClass: "text-white", starImage: '', numberColor: '' };
};
