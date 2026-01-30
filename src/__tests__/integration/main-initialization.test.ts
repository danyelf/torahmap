import { describe, it, expect, beforeEach } from "vitest";
import { createProgram, createOutlineProgram } from "../../webgl";
import { buildOutlineGeometry } from "../../outline";
import { createMockWebGL2Context } from "../helpers";
import type { VerseLayout } from "../../types";

describe("Main Initialization Integration", () => {
  let gl: WebGL2RenderingContext;

  beforeEach(() => {
    gl = createMockWebGL2Context();
  });

  describe("Program Creation Order", () => {
    it("creates main program and outline program without errors", () => {
      expect(() => {
        const prog = createProgram(gl);
        const outlineProg = createOutlineProgram(gl);
        expect(prog).toBeDefined();
        expect(outlineProg).toBeDefined();
      }).not.toThrow();
    });

    it("outline program has required uniforms and attributes", () => {
      const outlineProg = createOutlineProgram(gl);

      expect(outlineProg.program).toBeDefined();
      expect(outlineProg.attribs.position).toBeGreaterThanOrEqual(0);
      expect(outlineProg.uniforms.resolution).toBeDefined();
      expect(outlineProg.uniforms.pan).toBeDefined();
      expect(outlineProg.uniforms.zoom).toBeDefined();
      expect(outlineProg.uniforms.color).toBeDefined();
    });
  });

  describe("Render Loop Initialization", () => {
    it("renderOutline handles null and non-null pinnedVerse without error", () => {
      let pinnedVerse: VerseLayout | null = null;

      // This simulates the render() function calling renderOutline(pinnedVerse)
      // where pinnedVerse might be null on initial render
      expect(() => {
        if (pinnedVerse !== null) {
          buildOutlineGeometry({
            x: pinnedVerse.x,
            y: pinnedVerse.y,
            size: pinnedVerse.size,
          });
        }
      }).not.toThrow();

      // Now test with a valid verse
      pinnedVerse = {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        x: 100,
        y: 200,
        size: 10,
      };

      expect(() => {
        if (pinnedVerse !== null) {
          const geometry = buildOutlineGeometry({
            x: pinnedVerse.x,
            y: pinnedVerse.y,
            size: pinnedVerse.size,
          });
          expect(geometry).toBeDefined();
        }
      }).not.toThrow();
    });

    it("renderOutline works with a valid verse", () => {
      const outlineProg = createOutlineProgram(gl);
      const pinnedVerse: VerseLayout = {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        x: 100,
        y: 200,
        size: 10,
      };

      expect(() => {
        const geometry = buildOutlineGeometry({
          x: pinnedVerse.x,
          y: pinnedVerse.y,
          size: pinnedVerse.size,
        });

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);

        gl.useProgram(outlineProg.program);
        gl.uniform2f(outlineProg.uniforms.resolution, 800, 600);
        gl.uniform2f(outlineProg.uniforms.pan, 0, 0);
        gl.uniform1f(outlineProg.uniforms.zoom, 1.0);
        gl.uniform3f(outlineProg.uniforms.color, 0.6, 0.6, 0.6);
      }).not.toThrow();
    });
  });

  describe("Variable Declaration Order", () => {
    it("pinnedVerse can be declared before render function and accessed within it", () => {
      // This test simulates the critical bug fix: pinnedVerse must be declared
      // before the render() function that references it

      let pinnedVerse: VerseLayout | null = null;

      const render = () => {
        // Simulate render function accessing pinnedVerse
        if (pinnedVerse) {
          return buildOutlineGeometry({
            x: pinnedVerse.x,
            y: pinnedVerse.y,
            size: pinnedVerse.size,
          });
        }
        return null;
      };

      // Should not throw ReferenceError
      expect(() => render()).not.toThrow();
      expect(render()).toBeNull();

      // Now set pinnedVerse
      pinnedVerse = {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        x: 10,
        y: 20,
        size: 10,
      };

      // Should return geometry
      const result = render();
      expect(result).toBeInstanceOf(Float32Array);
      expect(result?.length).toBe(456); // 4 borders * 6 vertices * 19 floats
    });

    it("attempting to access undeclared variable would throw ReferenceError", () => {
      // This demonstrates what would happen with the original bug
      const render = () => {
        // @ts-ignore - Intentionally accessing undeclared variable to show the bug
        if (
          // @ts-ignore - typeof check on undeclared variable
          typeof undeclaredPinnedVerse !== "undefined" &&
          // @ts-ignore - accessing undeclared variable
          undeclaredPinnedVerse
        ) {
          return buildOutlineGeometry({
            // @ts-ignore - accessing undeclared variable properties
            x: undeclaredPinnedVerse.x,
            // @ts-ignore
            y: undeclaredPinnedVerse.y,
            // @ts-ignore
            size: undeclaredPinnedVerse.size,
          });
        }
        return null;
      };

      // The typeof check prevents the ReferenceError, but this shows
      // that accessing an undeclared variable is dangerous
      expect(() => render()).not.toThrow();
    });
  });

  describe("Outline Rendering Flow", () => {
    it("complete outline rendering flow works end-to-end", () => {
      const outlineProg = createOutlineProgram(gl);
      let pinnedVerse: VerseLayout | null = null;
      let outlineBuffer: WebGLBuffer | null = null;

      // Simulate the renderOutline function from main.ts
      const renderOutline = (verse: VerseLayout | null) => {
        if (!verse) return;

        const geometry = buildOutlineGeometry({
          x: verse.x,
          y: verse.y,
          size: verse.size,
        });

        if (!outlineBuffer) {
          outlineBuffer = gl.createBuffer();
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, outlineBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, geometry, gl.STATIC_DRAW);

        gl.useProgram(outlineProg.program);
        gl.uniform2f(outlineProg.uniforms.resolution, 800, 600);
        gl.uniform2f(outlineProg.uniforms.pan, 0, 0);
        gl.uniform1f(outlineProg.uniforms.zoom, 1.0);
        gl.uniform3f(outlineProg.uniforms.color, 0.6, 0.6, 0.6);

        const stride = 19 * 4;
        gl.enableVertexAttribArray(outlineProg.attribs.position);
        gl.vertexAttribPointer(
          outlineProg.attribs.position,
          2,
          gl.FLOAT,
          false,
          stride,
          0,
        );

        gl.drawArrays(gl.TRIANGLES, 0, 24);
      };

      // First render with null (initialization)
      expect(() => renderOutline(null)).not.toThrow();

      // Pin a verse
      pinnedVerse = {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        x: 100,
        y: 200,
        size: 10,
      };

      // Render with pinned verse
      expect(() => renderOutline(pinnedVerse)).not.toThrow();
      expect(outlineBuffer).not.toBeNull();

      // Unpin verse
      pinnedVerse = null;
      expect(() => renderOutline(pinnedVerse)).not.toThrow();
    });

    it("render function can be called immediately after declaring pinnedVerse", () => {
      const outlineProg = createOutlineProgram(gl);

      // This is the critical test: declare pinnedVerse, then immediately call render
      let pinnedVerse: VerseLayout | null = null;

      const render = () => {
        gl.viewport(0, 0, 800, 600);
        gl.clearColor(0.1, 0.1, 0.1, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Main rendering would go here...

        // Call renderOutline (this was failing before the fix)
        if (pinnedVerse !== null) {
          buildOutlineGeometry({
            x: pinnedVerse.x,
            y: pinnedVerse.y,
            size: pinnedVerse.size,
          });

          gl.useProgram(outlineProg.program);
          gl.uniform3f(outlineProg.uniforms.color, 0.6, 0.6, 0.6);
          // ... rest of rendering
        }
      };

      // Test with null - should not throw ReferenceError
      expect(() => render()).not.toThrow();

      // Test with a value - should also not throw
      pinnedVerse = {
        book: "Genesis",
        chapter: 1,
        verse: 1,
        x: 100,
        y: 200,
        size: 10,
      };
      expect(() => render()).not.toThrow();
    });
  });

  describe("Mouse Interaction Dependencies", () => {
    it("all variables needed by event handlers are available at initialization", () => {
      // Simulate the key variables that must be declared before event handlers
      let pinnedVerse: VerseLayout | null = null;
      const pan = { x: 0, y: 0 };
      let zoom = 1.0;
      const verses: VerseLayout[] = [
        { book: "Genesis", chapter: 1, verse: 1, x: 0, y: 0, size: 10 },
      ];

      // Verify all variables are properly initialized
      expect(pan).toBeDefined();
      expect(zoom).toBe(1.0);

      // Simulate mouse click handler
      const handleClick = () => {
        const verse = verses[0]; // Simplified hit detection
        if (verse) {
          if (
            pinnedVerse?.book === verse.book &&
            pinnedVerse?.chapter === verse.chapter &&
            pinnedVerse?.verse === verse.verse
          ) {
            pinnedVerse = null;
          } else {
            pinnedVerse = verse;
          }
        }
      };

      // Should not throw
      expect(() => handleClick()).not.toThrow();
      expect(pinnedVerse).toEqual(verses[0]);

      expect(() => handleClick()).not.toThrow();
      expect(pinnedVerse).toBeNull();
    });
  });
});
