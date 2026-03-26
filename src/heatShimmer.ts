// Heat Shimmer module - subtle ambient brightness animation for all verses
//
// Each verse subtly pulses in brightness (±5-8%) at different rates and phases,
// creating an organic "breathing" texture across the entire visualization.
// Uses a time uniform in the shader for GPU-efficient per-vertex oscillation.

/**
 * Start the heat shimmer animation loop.
 * Continuously updates the time uniform so the shader can compute
 * per-vertex brightness oscillation.
 *
 * @param gl - WebGL context
 * @param program - Main shader program
 * @param timeUniformLocation - Location of u_time uniform
 * @param renderCallback - Function to call each frame to trigger a re-render
 * @returns Cleanup function to stop the animation
 */
export function startHeatShimmer(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  timeUniformLocation: WebGLUniformLocation | null,
  renderCallback: () => void
): () => void {
  let animationId: number | null = null;
  let running = true;

  function tick(timestamp: number): void {
    if (!running) return;

    // Pass time in seconds to the shader
    const timeSeconds = timestamp / 1000.0;

    gl.useProgram(program);
    gl.uniform1f(timeUniformLocation, timeSeconds);

    renderCallback();

    animationId = requestAnimationFrame(tick);
  }

  animationId = requestAnimationFrame(tick);

  // Return cleanup function
  return () => {
    running = false;
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
    }
  };
}
