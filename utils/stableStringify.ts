// utils/stableStringify.ts

// This function is moved here to be shared between client and server code.

export const stableStringify = (data: any): string => {
    const processValue = (value: any): any => {
        if (value === null || typeof value !== 'object') {
            return value;
        }

        if (Array.isArray(value)) {
            // Arrays are not sorted to preserve order, but their contents are processed.
            return value.map(processValue);
        }
        
        // For objects, sort keys alphabetically to ensure consistent output
        const sortedKeys = Object.keys(value).sort();
        const newObj: { [key: string]: any } = {};
        for (const key of sortedKeys) {
            newObj[key] = processValue(value[key]);
        }
        return newObj;
    };
    
    return JSON.stringify(processValue(data));
};
