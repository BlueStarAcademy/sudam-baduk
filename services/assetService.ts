export const ALL_IMAGE_URLS: string[] = [];

export const preloadImages = (urls: string[]): Promise<(Event | string)[]> => {
    const promises = urls.map(url => {
        return new Promise<Event | string>((resolve) => {
            const img = new Image();
            img.src = url;
            img.onload = resolve;
            img.onerror = (err) => resolve(`Failed to load ${url}: ${err.toString()}`); 
        });
    });
    return Promise.all(promises);
};
