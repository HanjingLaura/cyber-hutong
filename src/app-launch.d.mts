export type LaunchTarget = { scheme?: string; href: string; mobileHref?: string };
export type LaunchEnv = { win: Window; doc: Document; mobile: boolean; timeoutMs?: number };
export function launchApp(app: LaunchTarget, env: LaunchEnv): Promise<'app' | 'web' | 'blocked'>;
