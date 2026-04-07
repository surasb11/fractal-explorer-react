
import { ColorScheme, FractalType, FractalConfig } from './types';

export const INITIAL_CONFIG: FractalConfig = {
  type: FractalType.MANDELBROT,
  zoom: 1.0,
  centerX: -0.5,
  centerY: 0.0,
  juliaC: { re: -0.4, im: 0.6 },
  iterations: 300,
  escapeRadius: 4.0,
  colorScheme: ColorScheme.ELECTRIC,
  smoothColoring: true,
  quality: 1, // 0: Low, 1: Medium, 2: High
  panSensitivity: 0.5,
};

export const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Fragment shader with supersampling support
export const FRAGMENT_SHADER_SOURCE = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform vec2 u_center;
  uniform float u_zoom;
  uniform int u_type; // 0: Mandelbrot, 1: Julia, 2: Burning Ship, 3: Tricorn, 4: Celtic, 5: Carpet, 6: Triangle, 7: Koch
  uniform vec2 u_juliaC;
  uniform int u_iterations;
  uniform float u_escapeRadius;
  uniform int u_colorScheme;
  uniform bool u_smooth;
  uniform int u_quality; // 0: Low, 1: Med, 2: High (AA)

  #define PI 3.14159265359

  // Cosine based palette
  vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
  }

  // Calculate color for a specific screen coordinate
  vec3 getFractalColor(vec2 coord) {
    // Coordinate mapping
    vec2 uv = (coord - 0.5 * u_resolution.xy) / u_resolution.y;
    
    // scale factor 
    float scale = 3.0 / u_zoom;
    vec2 c = u_center + uv * scale;
    
    vec2 z;
    vec2 initC;
    float iter = 0.0;
    float maxIter = float(u_iterations);
    float r2 = 0.0;

    // --- IFS / Geometric Fractals (Type >= 5) ---
    if (u_type >= 5) {
       z = c;
       
       if (u_type == 5) { // Sierpinski Carpet
         for (int i = 0; i < 2000; i++) {
           if (i >= u_iterations) break;
           
           // Check if in middle square of 3x3 grid
           // Domain logic: map z to 0..1 repeat
           z = fract(z + 0.5) - 0.5; 
           z *= 3.0;
           
           if (abs(z.x) < 0.5 && abs(z.y) < 0.5) {
             iter = float(i);
             // Make holes colored, set black
             // We return early, so "escaped"
             // Invert iter logic later for coloring?
             // Usually holes are 'trapped' -> low iter? 
             // Let's say escaping = finding a hole.
             break; 
           }
           
           if (i == u_iterations - 1) iter = float(u_iterations);
         }
       } 
       else if (u_type == 6) { // Sierpinski Triangle (Gasket)
         // Standard IFS folding
         z = c * 1.5; // adjust scale
         z.y += 0.25;
         
         for (int i = 0; i < 2000; i++) {
           if (i >= u_iterations) break;
           
           z = fract(z) - 0.5; // tiling
           z *= 2.0;
           
           // Symmetry fold
           float temp;
           if (z.x + z.y > 0.5) { z.xy = 0.5 - z.yx; } // Fold top right
           // Simple Gasket check: if we are in the hole?
           // Easier: De Jong style or just simple mod 2 check logic
           
           // Alternative: Analytic distance? No, loop.
           // Barycentric fold:
           // If y > 0.5, shift. 
           // Let's use simple logic:
           // If length grows, escape? No, Sierpinski is bounded.
           // Let's use "distance to set" approximation via orbit trap
           
           if (dot(z,z) > 100.0) { iter = float(i); break; } // Shouldn't happen in bounded IFS
           
           // Color by orbit
           iter += length(z); 
         }
         // Normalize iter for coloring
         iter = mod(iter * 10.0, maxIter);
       }
       else if (u_type == 7) { // Koch Snowflake (IFS)
          z = c * 3.0;
          z.x = abs(z.x);
          z.y += tan(radians(30.0)) * 0.5;
          
          vec2 n = vec2(sin(radians(60.0)), cos(radians(60.0))); // normal to fold
          
          for (int i=0; i<2000; i++) {
             if (i >= u_iterations) break;
             
             z.x = abs(z.x); // Fold x
             z.x -= 0.5;     // Shift
             z = z * 3.0;    // Scale ? Koch usually 3
             
             // Fold across line? 
             // This is tricky to get perfect in one go.
             // Let's use a simpler known Koch KIFS pattern
             
             z -= vec2(1.0, 0.0);
             float d = dot(z - vec2(0.5, 0.0), n);
             if (d > 0.0) z -= 2.0 * d * n;
             
             // Escape?
             if (dot(z,z) > u_escapeRadius) { iter = float(i); break; }
          }
       }
       
       // Handling coloring for IFS is different.
       // For Carpet (Type 5): if (iter < maxIter) -> hole -> color. Else black.
       if (u_type == 5) {
          if (iter >= maxIter - 1.0) return vec3(0.0); // Inside set
       }
    } 
    // --- Escape Time Fractals (Mandelbrot family) ---
    else { 
      if (u_type == 1) { // Julia
        z = c;
        initC = u_juliaC;
      } else { // Mandelbrot (0), Burning Ship (2), Tricorn (3), Celtic (4)
        initC = c;
        z = vec2(0.0);
      }
      
      for (int i = 0; i < 5000; i++) {
        if (i >= u_iterations) break;
        
        // Pre-calculation transformations
        if (u_type == 2) {
           // Burning Ship: z = (|Re(z)| + i|Im(z)|)^2 + c
           z = vec2(abs(z.x), abs(z.y));
        } else if (u_type == 3) {
           // Tricorn: z = conjugate(z)^2 + c
           z.y = -z.y;
        }
        
        // Standard z^2 calculation
        float x2 = z.x * z.x;
        float y2 = z.y * z.y;
        float twoxy = 2.0 * z.x * z.y;
        
        float nextX = x2 - y2;
        float nextY = twoxy;
        
        // Post-calculation transformations
        if (u_type == 4) {
           // Celtic: z = |Re(z^2)| + i Im(z^2) + c
           nextX = abs(nextX);
        }
        
        z = vec2(nextX, nextY) + initC;
        
        r2 = dot(z, z);
        if (r2 > u_escapeRadius * u_escapeRadius) {
          iter = float(i);
          break;
        }
        iter = float(i);
      }
      
      // Smooth coloring for escape time
      if (iter < maxIter - 1.0) {
          float smoothVal = iter;
          if (u_smooth) {
            smoothVal = iter + 1.0 - log2(log2(sqrt(r2)));
            smoothVal = max(0.0, smoothVal); 
          }
          iter = smoothVal;
      } else {
         return vec3(0.0);
      }
    }

    // --- Final Coloring ---
    float t = iter / 60.0; 
    if (u_type == 6) t = iter / 100.0; // Adjust for Triangle trap

    vec3 color = vec3(0.0);

    if (u_colorScheme == 0) { // Classic
       color = palette(t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67));
    } else if (u_colorScheme == 1) { // Electric
       color = palette(t, vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 0.5), vec3(0.8, 0.9, 0.3));
    } else if (u_colorScheme == 2) { // Magma
       color = palette(t, vec3(0.8, 0.5, 0.4), vec3(0.2, 0.4, 0.2), vec3(2.0, 1.0, 1.0), vec3(0.0, 0.25, 0.25));
    } else { // Rainbow
       color = palette(t, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.10, 0.20));
    }
    return color;
  }

  void main() {
    if (u_quality >= 2) {
        // 4x Supersampling
        vec3 col = vec3(0.0);
        col += getFractalColor(gl_FragCoord.xy + vec2(-0.25, -0.25));
        col += getFractalColor(gl_FragCoord.xy + vec2( 0.25, -0.25));
        col += getFractalColor(gl_FragCoord.xy + vec2(-0.25,  0.25));
        col += getFractalColor(gl_FragCoord.xy + vec2( 0.25,  0.25));
        gl_FragColor = vec4(col / 4.0, 1.0);
    } else {
        gl_FragColor = vec4(getFractalColor(gl_FragCoord.xy), 1.0);
    }
  }
`;
