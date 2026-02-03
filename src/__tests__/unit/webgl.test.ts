import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initWebGL, createProgram } from '../../webgl';
import { createMockWebGL2Context, createMockCanvas } from '../helpers';

describe('initWebGL', () => {
  describe('successful context creation', () => {
    it('returns WebGL2RenderingContext when supported', () => {
      const canvas = createMockCanvas();
      const gl = initWebGL(canvas);

      expect(gl).toBeDefined();
      expect(canvas.getContext).toHaveBeenCalledWith('webgl2', { antialias: true });
    });

    it('passes antialias option to getContext', () => {
      const canvas = createMockCanvas();
      initWebGL(canvas);

      expect(canvas.getContext).toHaveBeenCalledWith('webgl2', { antialias: true });
    });

    it('returns the context object', () => {
      const canvas = createMockCanvas();
      const gl = initWebGL(canvas);

      expect(gl).toBeInstanceOf(Object);
      expect(gl.createShader).toBeDefined();
      expect(gl.createProgram).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws error when WebGL2 is not supported', () => {
      const canvas = createMockCanvas();
      canvas.getContext = vi.fn(() => null);

      expect(() => initWebGL(canvas)).toThrow('WebGL2 not supported');
    });

    it('throws error when getContext returns null', () => {
      const canvas = {
        getContext: vi.fn(() => null),
      } as unknown as HTMLCanvasElement;

      expect(() => initWebGL(canvas)).toThrow('WebGL2 not supported');
    });

    it('throws error when getContext returns undefined', () => {
      const canvas = {
        getContext: vi.fn(() => undefined),
      } as unknown as HTMLCanvasElement;

      expect(() => initWebGL(canvas)).toThrow('WebGL2 not supported');
    });
  });

  describe('context configuration', () => {
    it('requests webgl2 context type', () => {
      const canvas = createMockCanvas();
      const getContextSpy = canvas.getContext as any;

      initWebGL(canvas);

      expect(getContextSpy).toHaveBeenCalledTimes(1);
      const callArgs = getContextSpy.mock.calls[0];
      expect(callArgs[0]).toBe('webgl2');
    });

    it('enables antialiasing by default', () => {
      const canvas = createMockCanvas();
      const getContextSpy = canvas.getContext as any;

      initWebGL(canvas);

      const callArgs = getContextSpy.mock.calls[0];
      expect(callArgs[1]).toEqual({ antialias: true });
    });
  });
});

describe('createProgram', () => {
  let gl: WebGL2RenderingContext;
  let mockShader: WebGLShader;
  let mockProgram: WebGLProgram;

  beforeEach(() => {
    gl = createMockWebGL2Context();
    mockShader = {} as WebGLShader;
    mockProgram = {} as WebGLProgram;

    // Reset mocks to successful state
    gl.createShader = vi.fn(() => mockShader);
    gl.shaderSource = vi.fn();
    gl.compileShader = vi.fn();
    gl.getShaderParameter = vi.fn(() => true);
    gl.getShaderInfoLog = vi.fn(() => null);
    gl.createProgram = vi.fn(() => mockProgram);
    gl.attachShader = vi.fn();
    gl.linkProgram = vi.fn();
    gl.getProgramParameter = vi.fn(() => true);
    gl.getProgramInfoLog = vi.fn(() => null);
  });

  describe('successful program creation', () => {
    it('creates and returns a shader program', () => {
      const program = createProgram(gl);

      expect(program).toBeDefined();
      expect(program.program).toBe(mockProgram);
    });

    it('compiles both vertex and fragment shaders', () => {
      createProgram(gl);

      expect(gl.createShader).toHaveBeenCalledTimes(2);
      expect(gl.createShader).toHaveBeenCalledWith(gl.VERTEX_SHADER);
      expect(gl.createShader).toHaveBeenCalledWith(gl.FRAGMENT_SHADER);
    });

    it('sets shader source for both shaders', () => {
      createProgram(gl);

      expect(gl.shaderSource).toHaveBeenCalledTimes(2);
      expect(gl.shaderSource).toHaveBeenCalledWith(mockShader, expect.any(String));
    });

    it('compiles both shaders', () => {
      createProgram(gl);

      expect(gl.compileShader).toHaveBeenCalledTimes(2);
      expect(gl.compileShader).toHaveBeenCalledWith(mockShader);
    });

    it('checks compilation status for both shaders', () => {
      createProgram(gl);

      expect(gl.getShaderParameter).toHaveBeenCalledTimes(2);
      expect(gl.getShaderParameter).toHaveBeenCalledWith(mockShader, gl.COMPILE_STATUS);
    });

    it('creates a program', () => {
      createProgram(gl);

      expect(gl.createProgram).toHaveBeenCalledTimes(1);
    });

    it('attaches both shaders to program', () => {
      createProgram(gl);

      expect(gl.attachShader).toHaveBeenCalledTimes(2);
      expect(gl.attachShader).toHaveBeenCalledWith(mockProgram, mockShader);
    });

    it('links the program', () => {
      createProgram(gl);

      expect(gl.linkProgram).toHaveBeenCalledTimes(1);
      expect(gl.linkProgram).toHaveBeenCalledWith(mockProgram);
    });

    it('checks link status', () => {
      createProgram(gl);

      expect(gl.getProgramParameter).toHaveBeenCalledWith(mockProgram, gl.LINK_STATUS);
    });
  });

  describe('shader compilation', () => {
    it('compiles vertex shader with correct source', () => {
      createProgram(gl);

      const shaderSourceCalls = (gl.shaderSource as any).mock.calls;
      const vertexShaderCall = shaderSourceCalls[0];
      const vertexSource = vertexShaderCall[1];

      expect(vertexSource).toContain('#version 300 es');
      expect(vertexSource).toContain('uniform vec2 u_resolution');
      expect(vertexSource).toContain('uniform vec2 u_pan');
      expect(vertexSource).toContain('uniform float u_zoom');
      expect(vertexSource).toContain('in vec2 a_position');
      expect(vertexSource).toContain('in vec3 a_color');
    });

    it('compiles fragment shader with correct source', () => {
      createProgram(gl);

      const shaderSourceCalls = (gl.shaderSource as any).mock.calls;
      const fragmentShaderCall = shaderSourceCalls[1];
      const fragmentSource = fragmentShaderCall[1];

      expect(fragmentSource).toContain('#version 300 es');
      expect(fragmentSource).toContain('precision mediump float');
      expect(fragmentSource).toContain('in vec3 v_color');
      expect(fragmentSource).toContain('out vec4 fragColor');
    });

    it('vertex shader includes all required attributes', () => {
      createProgram(gl);

      const vertexSource = (gl.shaderSource as any).mock.calls[0][1];

      // Check for specific attribute declarations
      expect(vertexSource).toContain('in vec2 a_position');
      expect(vertexSource).toContain('in vec3 a_color');
      expect(vertexSource).toContain('in vec3 a_color2');
      expect(vertexSource).toContain('in vec3 a_color3');
      expect(vertexSource).toContain('in vec3 a_color4');
      expect(vertexSource).toContain('in float a_colorCount');
      expect(vertexSource).toContain('in vec2 a_uv');
    });

    it('vertex shader includes all required uniforms', () => {
      createProgram(gl);

      const vertexSource = (gl.shaderSource as any).mock.calls[0][1];
      expect(vertexSource).toContain('uniform vec2 u_resolution');
      expect(vertexSource).toContain('uniform vec2 u_pan');
      expect(vertexSource).toContain('uniform float u_zoom');
    });

    it('fragment shader includes color interpolation logic', () => {
      createProgram(gl);

      const fragmentSource = (gl.shaderSource as any).mock.calls[1][1];
      expect(fragmentSource).toContain('v_colorCount');
      expect(fragmentSource).toContain('v_uv');
      expect(fragmentSource).toContain('hash');
    });
  });

  describe('attribute locations', () => {
    it('returns all required attribute locations', () => {
      const program = createProgram(gl);

      expect(program.attribs).toBeDefined();
      expect(program.attribs.position).toBeDefined();
      expect(program.attribs.color).toBeDefined();
      expect(program.attribs.color2).toBeDefined();
      expect(program.attribs.color3).toBeDefined();
      expect(program.attribs.color4).toBeDefined();
      expect(program.attribs.colorCount).toBeDefined();
      expect(program.attribs.uv).toBeDefined();
    });

    it('queries correct attribute names', () => {
      createProgram(gl);

      expect(gl.getAttribLocation).toHaveBeenCalledWith(mockProgram, 'a_position');
      expect(gl.getAttribLocation).toHaveBeenCalledWith(mockProgram, 'a_color');
      expect(gl.getAttribLocation).toHaveBeenCalledWith(mockProgram, 'a_color2');
      expect(gl.getAttribLocation).toHaveBeenCalledWith(mockProgram, 'a_color3');
      expect(gl.getAttribLocation).toHaveBeenCalledWith(mockProgram, 'a_color4');
      expect(gl.getAttribLocation).toHaveBeenCalledWith(mockProgram, 'a_colorCount');
      expect(gl.getAttribLocation).toHaveBeenCalledWith(mockProgram, 'a_uv');
    });

    it('attribute locations match mock values', () => {
      const program = createProgram(gl);

      // Mock returns specific indices for each attribute
      expect(program.attribs.position).toBe(0);
      expect(program.attribs.color).toBe(1);
      expect(program.attribs.color2).toBe(2);
      expect(program.attribs.color3).toBe(3);
      expect(program.attribs.color4).toBe(4);
      expect(program.attribs.colorCount).toBe(5);
      expect(program.attribs.uv).toBe(6);
    });
  });

  describe('uniform locations', () => {
    it('returns all required uniform locations', () => {
      const program = createProgram(gl);

      expect(program.uniforms).toBeDefined();
      expect(program.uniforms.resolution).toBeDefined();
      expect(program.uniforms.pan).toBeDefined();
      expect(program.uniforms.zoom).toBeDefined();
    });

    it('queries correct uniform names', () => {
      createProgram(gl);

      expect(gl.getUniformLocation).toHaveBeenCalledWith(mockProgram, 'u_resolution');
      expect(gl.getUniformLocation).toHaveBeenCalledWith(mockProgram, 'u_pan');
      expect(gl.getUniformLocation).toHaveBeenCalledWith(mockProgram, 'u_zoom');
    });

    it('stores uniform location objects', () => {
      const program = createProgram(gl);

      expect(program.uniforms.resolution).toBeInstanceOf(Object);
      expect(program.uniforms.pan).toBeInstanceOf(Object);
      expect(program.uniforms.zoom).toBeInstanceOf(Object);
    });
  });

  describe('error handling - shader compilation', () => {
    it('throws error when vertex shader creation fails', () => {
      gl.createShader = vi.fn(() => null);

      expect(() => createProgram(gl)).toThrow('Failed to create shader');
    });

    it('throws error when fragment shader creation fails', () => {
      let callCount = 0;
      gl.createShader = vi.fn(() => {
        callCount++;
        return callCount === 1 ? mockShader : null;
      });

      expect(() => createProgram(gl)).toThrow('Failed to create shader');
    });

    it('throws error when vertex shader compilation fails', () => {
      gl.getShaderParameter = vi.fn(() => false);
      gl.getShaderInfoLog = vi.fn(() => 'Vertex shader compilation error');

      expect(() => createProgram(gl)).toThrow('Vertex shader compilation error');
    });

    it('throws error when fragment shader compilation fails', () => {
      let callCount = 0;
      gl.getShaderParameter = vi.fn(() => {
        callCount++;
        return callCount === 1 ? true : false;
      });
      gl.getShaderInfoLog = vi.fn(() => 'Fragment shader compilation error');

      expect(() => createProgram(gl)).toThrow('Fragment shader compilation error');
    });

    it('throws generic error when shader compilation fails with no log', () => {
      gl.getShaderParameter = vi.fn(() => false);
      gl.getShaderInfoLog = vi.fn(() => null);

      expect(() => createProgram(gl)).toThrow('Shader compilation failed');
    });

    it('throws error with empty string log', () => {
      gl.getShaderParameter = vi.fn(() => false);
      gl.getShaderInfoLog = vi.fn(() => '');

      expect(() => createProgram(gl)).toThrow('Shader compilation failed');
    });

    it('includes shader info log in error message', () => {
      gl.getShaderParameter = vi.fn(() => false);
      const errorLog = 'ERROR: 0:1: Syntax error at token "uniform"';
      gl.getShaderInfoLog = vi.fn(() => errorLog);

      expect(() => createProgram(gl)).toThrow(errorLog);
    });
  });

  describe('error handling - program linking', () => {
    it('throws error when program creation fails', () => {
      gl.createProgram = vi.fn(() => null) as unknown as () => WebGLProgram;

      expect(() => createProgram(gl)).toThrow('Failed to create program');
    });

    it('throws error when program linking fails', () => {
      gl.getProgramParameter = vi.fn(() => false);
      gl.getProgramInfoLog = vi.fn(() => 'Program linking failed: attribute mismatch');

      expect(() => createProgram(gl)).toThrow('Program linking failed: attribute mismatch');
    });

    it('throws generic error when linking fails with no log', () => {
      gl.getProgramParameter = vi.fn(() => false);
      gl.getProgramInfoLog = vi.fn(() => null);

      expect(() => createProgram(gl)).toThrow('Program linking failed');
    });

    it('throws error with empty program info log', () => {
      gl.getProgramParameter = vi.fn(() => false);
      gl.getProgramInfoLog = vi.fn(() => '');

      expect(() => createProgram(gl)).toThrow('Program linking failed');
    });

    it('includes program info log in error message', () => {
      gl.getProgramParameter = vi.fn(() => false);
      const errorLog = 'ERROR: Missing vertex shader output';
      gl.getProgramInfoLog = vi.fn(() => errorLog);

      expect(() => createProgram(gl)).toThrow(errorLog);
    });
  });

  describe('shader program structure', () => {
    it('returns object with program, attribs, and uniforms', () => {
      const program = createProgram(gl);

      expect(program).toHaveProperty('program');
      expect(program).toHaveProperty('attribs');
      expect(program).toHaveProperty('uniforms');
    });

    it('program property contains WebGLProgram', () => {
      const program = createProgram(gl);

      expect(program.program).toBe(mockProgram);
    });

    it('attribs contains all 8 attributes', () => {
      const program = createProgram(gl);

      const attribKeys = Object.keys(program.attribs);
      expect(attribKeys).toHaveLength(8);
      expect(attribKeys).toContain('position');
      expect(attribKeys).toContain('color');
      expect(attribKeys).toContain('color2');
      expect(attribKeys).toContain('color3');
      expect(attribKeys).toContain('color4');
      expect(attribKeys).toContain('colorCount');
      expect(attribKeys).toContain('uv');
      expect(attribKeys).toContain('seed');
    });

    it('uniforms contains all 3 uniforms', () => {
      const program = createProgram(gl);

      const uniformKeys = Object.keys(program.uniforms);
      expect(uniformKeys).toHaveLength(3);
      expect(uniformKeys).toContain('resolution');
      expect(uniformKeys).toContain('pan');
      expect(uniformKeys).toContain('zoom');
    });
  });

  describe('execution order', () => {
    it('creates vertex shader before fragment shader', () => {
      const createShaderCalls: number[] = [];
      gl.createShader = vi.fn((type) => {
        createShaderCalls.push(type);
        return mockShader;
      });

      createProgram(gl);

      expect(createShaderCalls[0]).toBe(gl.VERTEX_SHADER);
      expect(createShaderCalls[1]).toBe(gl.FRAGMENT_SHADER);
    });

    it('compiles shaders before creating program', () => {
      const callOrder: string[] = [];
      gl.compileShader = vi.fn(() => callOrder.push('compile'));
      gl.createProgram = vi.fn(() => {
        callOrder.push('createProgram');
        return mockProgram;
      });

      createProgram(gl);

      expect(callOrder.indexOf('compile')).toBeLessThan(callOrder.indexOf('createProgram'));
    });

    it('attaches shaders before linking', () => {
      const callOrder: string[] = [];
      gl.attachShader = vi.fn(() => callOrder.push('attach'));
      gl.linkProgram = vi.fn(() => callOrder.push('link'));

      createProgram(gl);

      const firstAttach = callOrder.indexOf('attach');
      const link = callOrder.indexOf('link');
      expect(firstAttach).toBeLessThan(link);
    });

    it('links program before querying attribute locations', () => {
      const callOrder: string[] = [];
      gl.linkProgram = vi.fn(() => callOrder.push('link'));
      gl.getAttribLocation = vi.fn(() => {
        callOrder.push('getAttrib');
        return 0;
      });

      createProgram(gl);

      expect(callOrder.indexOf('link')).toBeLessThan(callOrder.indexOf('getAttrib'));
    });

    it('links program before querying uniform locations', () => {
      const callOrder: string[] = [];
      gl.linkProgram = vi.fn(() => callOrder.push('link'));
      gl.getUniformLocation = vi.fn(() => {
        callOrder.push('getUniform');
        return {} as WebGLUniformLocation;
      });

      createProgram(gl);

      expect(callOrder.indexOf('link')).toBeLessThan(callOrder.indexOf('getUniform'));
    });
  });

  describe('shader source validation', () => {
    it('vertex shader uses GLSL ES 3.0', () => {
      createProgram(gl);
      const vertexSource = (gl.shaderSource as any).mock.calls[0][1];
      expect(vertexSource).toMatch(/^#version 300 es/);
    });

    it('fragment shader uses GLSL ES 3.0', () => {
      createProgram(gl);
      const fragmentSource = (gl.shaderSource as any).mock.calls[1][1];
      expect(fragmentSource).toMatch(/^#version 300 es/);
    });

    it('vertex shader passes colors to fragment shader', () => {
      createProgram(gl);
      const vertexSource = (gl.shaderSource as any).mock.calls[0][1];

      expect(vertexSource).toContain('out vec3 v_color');
      expect(vertexSource).toContain('out vec3 v_color2');
      expect(vertexSource).toContain('out vec3 v_color3');
      expect(vertexSource).toContain('out vec3 v_color4');
      expect(vertexSource).toContain('v_color = a_color');
    });

    it('fragment shader receives colors from vertex shader', () => {
      createProgram(gl);
      const fragmentSource = (gl.shaderSource as any).mock.calls[1][1];

      expect(fragmentSource).toContain('in vec3 v_color');
      expect(fragmentSource).toContain('in vec3 v_color2');
      expect(fragmentSource).toContain('in vec3 v_color3');
      expect(fragmentSource).toContain('in vec3 v_color4');
    });

    it('fragment shader uses flat interpolation for colorCount', () => {
      createProgram(gl);
      const fragmentSource = (gl.shaderSource as any).mock.calls[1][1];

      expect(fragmentSource).toContain('flat in int v_colorCount');
    });

    it('vertex shader transforms positions correctly', () => {
      createProgram(gl);
      const vertexSource = (gl.shaderSource as any).mock.calls[0][1];

      expect(vertexSource).toContain('a_position + u_pan');
      expect(vertexSource).toContain('* u_zoom');
      expect(vertexSource).toContain('gl_Position');
    });
  });

  describe('WebGL state management', () => {
    it('does not modify global WebGL state', () => {
      createProgram(gl);

      // createProgram should not call state-changing functions like useProgram
      expect(gl.useProgram).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles very long shader info logs', () => {
      gl.getShaderParameter = vi.fn(() => false);
      const longLog = 'ERROR: '.repeat(1000);
      gl.getShaderInfoLog = vi.fn(() => longLog);

      expect(() => createProgram(gl)).toThrow(longLog);
    });

    it('handles shader info log with special characters', () => {
      gl.getShaderParameter = vi.fn(() => false);
      const specialLog = 'ERROR: Invalid character \n\t\r "quotes" \'apostrophes\'';
      gl.getShaderInfoLog = vi.fn(() => specialLog);

      expect(() => createProgram(gl)).toThrow(specialLog);
    });

    it('handles multiple rapid program creations', () => {
      for (let i = 0; i < 10; i++) {
        const program = createProgram(gl);
        expect(program).toBeDefined();
      }

      expect(gl.createShader).toHaveBeenCalledTimes(20); // 2 per program
      expect(gl.createProgram).toHaveBeenCalledTimes(10);
    });
  });
});
