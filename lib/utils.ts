export function delay(time):Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, time));
} 