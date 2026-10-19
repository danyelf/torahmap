// A WebGL context and canvas that record calls instead of drawing.
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
    BLEND: 3042,
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
        'a_rect': 0,
        'a_fill': 1,
        'a_ring': 2,
        'a_shape': 3,
        'a_nextFill': 4,
        'a_nextRing': 5,
        'a_nextShape': 6,
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
    vertexAttribDivisor: vi.fn(),
    disableVertexAttribArray: vi.fn(),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),

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
    drawArraysInstanced: vi.fn(),
    drawElements: vi.fn(),

    // State
    viewport: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    blendFuncSeparate: vi.fn(),

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
