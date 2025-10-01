const KST_OFFSET = 9 * 60 * 60 * 1000;

export interface SeasonInfo {
    year: number;
    season: 1 | 2 | 3 | 4;
    name: string; // e.g., '25-1시즌'
}

export const getKSTDate = (date: Date | number = Date.now()): Date => {
    const utc = typeof date === 'number' ? date : date.getTime();
    return new Date(utc + KST_OFFSET);
};

export const getTimeUntilNextMondayKST = (): number => {
    const nowKST = getKSTDate(); // uses current time by default
    const currentDay = nowKST.getUTCDay(); // 0=Sun, 1=Mon

    // Days to add to reach next Monday.
    // If today is Monday (1), we want to reach next Monday, so add 7.
    // If today is Sunday (0), we want to reach tomorrow, so add 1.
    const daysToAdd = currentDay === 1 ? 7 : (8 - currentDay) % 7;
    
    const nextMonday = new Date(nowKST);
    nextMonday.setUTCDate(nowKST.getUTCDate() + daysToAdd);
    nextMonday.setUTCHours(0, 0, 0, 0);

    return nextMonday.getTime() - nowKST.getTime();
};


export const isSameDayKST = (ts1: number | undefined | null, ts2: number): boolean => {
    if (!ts1 || ts1 === 0) return false;
    const d1 = getKSTDate(ts1);
    const d2 = getKSTDate(ts2);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
};

export const isDifferentDayKST = (ts1: number | undefined | null, ts2: number): boolean => {
    if (!ts1 || ts1 === 0) return true;
    return !isSameDayKST(ts1, ts2);
};

export const isDifferentWeekKST = (ts1: number | undefined | null, ts2: number): boolean => {
    if (!ts1 || ts1 === 0) return true; // Treat no previous update as a new week

    const d1 = getKSTDate(ts1);
    const d2 = getKSTDate(ts2);
    
    // If years are different, it's definitely a different week
    if (d1.getUTCFullYear() !== d2.getUTCFullYear()) {
        return true;
    }

    // Calculate the date of the Monday for each date
    const day1 = d1.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diff1 = d1.getUTCDate() - day1 + (day1 === 0 ? -6 : 1); // Adjust for Sunday
    const monday1 = new Date(d1);
    monday1.setUTCDate(diff1);
    monday1.setUTCHours(0, 0, 0, 0);

    const day2 = d2.getUTCDay();
    const diff2 = d2.getUTCDate() - day2 + (day2 === 0 ? -6 : 1);
    const monday2 = new Date(d2);
    monday2.setUTCDate(diff2);
    monday2.setUTCHours(0, 0, 0, 0);

    return monday1.getTime() !== monday2.getTime();
};

export const isDifferentMonthKST = (ts1: number | undefined | null, ts2: number): boolean => {
    if (!ts1 || ts1 === 0) return true;
    const d1 = getKSTDate(ts1);
    const d2 = getKSTDate(ts2);

    return d1.getUTCFullYear() !== d2.getUTCFullYear() || d1.getUTCMonth() !== d2.getUTCMonth();
};


export const getCurrentSeason = (date: Date | number = Date.now()): SeasonInfo => {
    const d = getKSTDate(date);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-11
    let season: 1 | 2 | 3 | 4;

    if (month < 3) season = 1;      // Jan, Feb, Mar (Month 0, 1, 2)
    else if (month < 6) season = 2; // Apr, May, Jun (Month 3, 4, 5)
    else if (month < 9) season = 3; // Jul, Aug, Sep (Month 6, 7, 8)
    else season = 4;                // Oct, Nov, Dec (Month 9, 10, 11)
    
    const shortYear = year.toString().slice(-2);
    return { year, season, name: `${shortYear}-${season}시즌` };
};

export const getPreviousSeason = (date: Date | number = Date.now()): SeasonInfo => {
    const d = getKSTDate(date);
    const currentYear = d.getUTCFullYear();
    const currentMonth = d.getUTCMonth();
    
    let prevYear = currentYear;
    let prevSeason: 1 | 2 | 3 | 4;

    if (currentMonth < 3) { // Q1 -> prev year Q4
        prevSeason = 4;
        prevYear -= 1;
    } else if (currentMonth < 6) { // Q2 -> Q1
        prevSeason = 1;
    } else if (currentMonth < 9) { // Q3 -> Q2
        prevSeason = 2;
    } else { // Q4 -> Q3
        prevSeason = 3;
    }

    const shortYear = prevYear.toString().slice(-2);
    return { year: prevYear, season: prevSeason, name: `${shortYear}-${prevSeason}시즌` };
};

export const formatTimeAgo = (timestamp: number | undefined | null): string => {
    if (!timestamp) return '오래 전';
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)}년 전`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)}달 전`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)}일 전`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)}시간 전`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}분 전`;
    return '방금 전';
};

export const formatDateTimeKST = (timestamp: number): string => {
    if (!timestamp) return '';
    const d = getKSTDate(timestamp);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export const formatLastLogin = (timestamp: number | undefined | null): string => {
    if (!timestamp || timestamp === 0) return '오래 전';

    const kstNow = getKSTDate();
    const kstLastLogin = getKSTDate(timestamp);
    
    const startOfTodayKST = new Date(kstNow);
    startOfTodayKST.setUTCHours(0, 0, 0, 0);

    const startOfLoginDayKST = new Date(kstLastLogin);
    startOfLoginDayKST.setUTCHours(0, 0, 0, 0);

    if (startOfTodayKST.getTime() === startOfLoginDayKST.getTime()) {
        return '오늘';
    }

    const diffTime = startOfTodayKST.getTime() - startOfLoginDayKST.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
        return `${diffDays}일 전`;
    }

    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}달 전`;
};