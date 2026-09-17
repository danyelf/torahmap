// Mock implementations for testing
import { vi } from 'vitest';

// Lets tests run without a real GPU/browser environment.
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
    getAttribLocation: vi.fn((_program, name) => {
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
    getUniformLocation: vi.fn((_program, _name) => mockUniformLocation),

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

// A response entry is normally just the JSON body a URL should resolve to
// (200, ok: true). Wrap it in mockFetchStatus() when a test needs a specific
// status code instead, such as a 404 or 500 error path.
class MockResponseStatus {
  constructor(
    public status: number,
    public body: unknown = null,
  ) {}
}

export function mockFetchStatus(status: number, body: unknown = null): MockResponseStatus {
  return new MockResponseStatus(status, body);
}

// Installs a fetch mock keyed by URL and returns it, so callers can still
// assert on calls or layer one-off overrides with mockResolvedValueOnce /
// mockRejectedValueOnce for behavior a static URL map can't express (a
// rejected fetch, a response whose .json() itself rejects).
export function mockFetch(responses: Record<string, unknown> = {}) {
  const defaultResponses: Record<string, unknown> = {
    '/data/tanakh-structure.json': { books: [] },
    '/data/all-texts.json': {},
    '/data/overlays/commentary/counts.json': {},
    ...responses,
  };

  const fetchMock = vi.fn((url: string | URL | Request) => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    const entry = defaultResponses[urlString];

    if (entry instanceof MockResponseStatus) {
      const { status, body } = entry;
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      } as Response);
    }

    return Promise.resolve({
      ok: !!entry,
      status: entry ? 200 : 404,
      json: () => Promise.resolve(entry),
      text: () => Promise.resolve(JSON.stringify(entry)),
    } as Response);
  });

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export function restoreAllMocks() {
  vi.restoreAllMocks();
}
