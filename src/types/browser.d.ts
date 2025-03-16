import { Browser } from 'webextension-polyfill';

declare module 'webextension-polyfill' {
  interface SidePanelOpenOptions {
    tabId?: number;
    windowId?: number;
  }

  interface SidePanel {
    open(options?: SidePanelOpenOptions): Promise<void>;
    setOptions(options: { path?: string }): Promise<void>;
  }

  interface Browser {
    sidePanel?: SidePanel;
  }
}
