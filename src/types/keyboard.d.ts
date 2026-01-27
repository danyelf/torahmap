// Type definitions for GreyWyvern Virtual Keyboard Interface

interface VKI_Config {
  kt: string;           // Default keyboard layout
  deadkeysOn: boolean;  // Enable dead keys
  numberPadOn: boolean; // Show number pad
  sizeAdj: boolean;     // Allow size adjustment
  langAdapt: boolean;   // Auto-adapt to input lang attribute
  imageURI: string;     // Path to keyboard images
  clickless: number;    // Clickless mode setting
  clearPasswords: boolean; // Clear password fields
}

interface Window {
  VKI?: VKI_Config;
  VKI_attach?: (element: HTMLElement) => void;
  VKI_close?: () => void;
}

interface HTMLInputElement {
  VKI_attached?: boolean;
}
