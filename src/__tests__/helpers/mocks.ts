// Mock implementations for testing
import { vi } from 'vitest';

/**
 * Creates a minimal mock WebGL2RenderingContext for testing
 * This allows tests to run without a real GPU/browser environment
 */
export function createMockWebGL2Context(): WebGL2RenderingContext {
  const mockShader = {} as WebGLShader;
  const mockProgram = {} as WebGLProgram;
  const mockBuffer = {} as WebGLBuffer;
  const mockUniformLocation = {} as WebGLUniformLocation;

  const gl = {
    // Constants
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    TRIANGLES: 4,
    FLOAT: 5126,

    // Shader operations
    createShader: vi.fn(() => mockShader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => null),
    deleteShader: vi.fn(),

    // Program operations
    createProgram: vi.fn(() => mockProgram),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => null),
    useProgram: vi.fn(),
    deleteProgram: vi.fn(),

    // Attribute and uniform locations
    getAttribLocation: vi.fn((program, name) => {
      const locations: Record<string, number> = {
        'a_position': 0,
        'a_color': 1,
        'a_color2': 2,
        'a_color3': 3,
        'a_color4': 4,
        'a_colorCount': 5,
        'a_uv': 6,
      };
      return locations[name] ?? -1;
    }),
    getUniformLocation: vi.fn((program, name) => mockUniformLocation),

    // Buffer operations
    createBuffer: vi.fn(() => mockBuffer),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),

    // Vertex attributes
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    disableVertexAttribArray: vi.fn(),

    // Uniforms
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2fv: vi.fn(),
    uniformMatrix4fv: vi.fn(),

    // Drawing
    drawArrays: vi.fn(),
    drawElements: vi.fn(),

    // State
    viewport: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),

    // Canvas
    canvas: {
      width: 800,
      height: 600,
    },
  } as unknown as WebGL2RenderingContext;

  return gl;
}

/**
 * Creates a mock HTMLCanvasElement with getContext that returns mock WebGL2
 */
export function createMockCanvas(): HTMLCanvasElement {
  const mockGL = createMockWebGL2Context();

  const canvas = {
    width: 800,
    height: 600,
    getContext: vi.fn((type: string) => {
      if (type === 'webgl2') {
        return mockGL;
      }
      return null;
    }),
    getBoundingClientRect: vi.fn(() => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement;

  return canvas;
}

/**
 * Mocks window.location for URL state testing
 */
export function mockWindowLocation(url: string = 'http://localhost:5173/') {
  const urlObj = new URL(url);

  delete (window as any).location;
  (window as any).location = {
    href: urlObj.href,
    protocol: urlObj.protocol,
    host: urlObj.host,
    hostname: urlObj.hostname,
    port: urlObj.port,
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
    origin: urlObj.origin,
  };
}

/**
 * Creates a mock HTMLElement for testing UI controls
 */
export function createMockElement(tagName: string = 'div'): HTMLElement {
  const element = {
    tagName: tagName.toUpperCase(),
    innerHTML: '',
    textContent: '',
    className: '',
    id: '',
    children: [] as HTMLElement[],
    style: {} as CSSStyleDeclaration,

    appendChild: vi.fn((child: HTMLElement) => {
      element.children.push(child);
      return child;
    }),
    removeChild: vi.fn((child: HTMLElement) => {
      const index = element.children.indexOf(child);
      if (index > -1) {
        element.children.splice(index, 1);
      }
      return child;
    }),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    removeAttribute: vi.fn(),
  } as unknown as HTMLElement;

  return element;
}

/**
 * Mock for document.createElement
 */
export function mockDocumentCreateElement() {
  const originalCreateElement = document.createElement.bind(document);

  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    if (tagName === 'canvas') {
      return createMockCanvas();
    }
    return createMockElement(tagName);
  });

  return () => {
    (document.createElement as any).mockRestore?.();
  };
}

/**
 * Creates a mock for the URLSearchParams API
 */
export function createMockURLSearchParams(params: Record<string, string> = {}): URLSearchParams {
  const map = new Map(Object.entries(params));

  return {
    get: vi.fn((key: string) => map.get(key) ?? null),
    set: vi.fn((key: string, value: string) => map.set(key, value)),
    has: vi.fn((key: string) => map.has(key)),
    delete: vi.fn((key: string) => map.delete(key)),
    toString: vi.fn(() => {
      const pairs: string[] = [];
      map.forEach((value, key) => {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      });
      return pairs.join('&');
    }),
    entries: vi.fn(() => map.entries()),
    keys: vi.fn(() => map.keys()),
    values: vi.fn(() => map.values()),
    forEach: vi.fn((callback) => map.forEach(callback)),
  } as unknown as URLSearchParams;
}

/**
 * Mock fetch for loading external data
 */
export function mockFetch(responses: Record<string, any> = {}) {
  const defaultResponses: Record<string, any> = {
    '/data/tanakh-structure.json': { books: [] },
    '/data/all-texts.json': {},
    '/data/commentary-counts.json': {},
    ...responses,
  };

  global.fetch = vi.fn((url: string | Request) => {
    const urlString = typeof url === 'string' ? url : url.url;
    const data = defaultResponses[urlString];

    return Promise.resolve({
      ok: !!data,
      status: data ? 200 : 404,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
    } as Response);
  });

  return () => {
    (global.fetch as any).mockRestore?.();
  };
}

/**
 * Helper to restore all mocks
 */
export function restoreAllMocks() {
  vi.restoreAllMocks();
}
