import { Mat3, type OGLRenderingContext, Program, Texture, Vec2 } from "ogl";
import { QUAD_VERTEX_SHADER } from "../gl";

type ConversionUniforms = {
	tPalette: { value: Texture };
	uPaletteSize: { value: number };
	tInput: { value: Texture };
	uInputSize: { value: Vec2 };
	uOutputSize: { value: Vec2 };
};

// CIEDE2000 loosely based on both:
// https://github.com/yuki-koyama/color-util/blob/master/include/color-util/CIEDE2000.hpp
// https://www.shadertoy.com/view/msXyz8
const CIEDE2000 = /* glsl */ `
const float EPSILON = 0.00001;

float sinr(float x) { return sin(radians(x)); }
float cosr(float x) { return cos(radians(x)); }
float atanr(float y, float x) {
	float v = degrees(atan(y, x));
	if (v < 0.0) {
		return v + 360.0;
	} else {
		return v;
	}
}

float get_h(float a, float b) {
	if ((abs(a) < EPSILON) && (abs(b) < EPSILON)) {
		return 0.0;
	} else {
		return atanr(b, a);
	}
}

float get_delta_h(float C1, float C2, float h1, float h2) {
	float diff = h2 - h1;
	if (C1 * C2 < EPSILON) {
		return 0.0;
	} else if (diff < -180.0) {
		return diff + 360.0;
	} else if (diff > 180.0) {
		return diff - 360.0;
	} else {
		return diff;
	}
}

float get_h_bar(float C1, float C2, float h1, float h2) {
	float dist = abs(h1 - h2);
	float sum = h1 + h2;
	if (C1 * C2 < EPSILON) {
		return h1 + h2;
	} else if (dist <= 180.0) {
		return 0.5 * sum;
	} else if (sum < 360.0) {
		return 0.5 * (sum + 360.0);
	} else {
		return 0.5 * (sum - 360.0);
	}
	
}

float calculate_CIEDE2000(vec3 Lab1, vec3 Lab2) {
	float L1 = Lab1.x;
	float a1 = Lab1.y;
	float b1 = Lab1.z;
	float L2 = Lab2.x;
	float a2 = Lab2.y;
	float b2 = Lab2.z;
	
	float C1_ab = sqrt(a1 * a1 + b1 * b1);
	float C2_ab = sqrt(a2 * a2 + b2 * b2);
	float C_ab_bar = 0.5 * (C1_ab + C2_ab);
	float G = 0.5 * (1.0 - sqrt(pow(C_ab_bar, 7.0) / (pow(C_ab_bar, 7.0) + pow(25.0, 7.0))));
	float a_1 = (1.0 + G) * a1;
	float a_2 = (1.0 + G) * a2;
	float C1 = sqrt(a_1 * a_1 + b1 * b1);
	float C2 = sqrt(a_2 * a_2 + b2 * b2);
	float h1 = get_h(a_1, b1);
	float h2 = get_h(a_2, b2);
	
	float delta_L = L2 - L1;
	float delta_C = C2 - C1;
	float delta_h = get_delta_h(C1, C2, h1, h2);
	float delta_H = 2.0 * sqrt(C1 * C2) * sinr(0.5 * delta_h);
	
	float L_bar = 0.5 * (L1 + L2);
	float C_bar = 0.5 * (C1 + C2);
	float h_bar = get_h_bar(C1, C2, h1, h2);
	
	float T = 1.0 - 0.17 * cosr(h_bar - 30.0)
		+ 0.24 * cosr(2.0 * h_bar)
		+ 0.32 * cosr(3.0 * h_bar + 6.0)
		- 0.20 * cosr(4.0 * h_bar - 63.0);
	
	float delta_theta = 30.0 * exp(-((h_bar - 275.0) / 25.0) * ((h_bar - 275.0) / 25.0));
	
	float R_C = 2.0 * sqrt(pow(C_bar, 7.0) / (pow(C_bar, 7.0) + pow(25.0, 7.0)));
	float S_L = 1.0 + (0.015 * (L_bar - 50.0) * (L_bar - 50.0)) / sqrt(20.0 + (L_bar - 50.0) * (L_bar - 50.0));
	float S_C = 1.0 + 0.045 * C_bar;
	float S_H = 1.0 + 0.015 * C_bar * T;
	float R_T = -sinr(2.0 * delta_theta) * R_C;
	
	const float k_L = 1.0;
	const float k_C = 1.0;
	const float k_H = 1.0;
	
	float deltaL = delta_L / (k_L * S_L);
	float deltaC = delta_C / (k_C * S_C);
	float deltaH = delta_H / (k_H * S_H);
	
	float delta_E_squared = deltaL * deltaL + deltaC * deltaC + deltaH * deltaH + R_T * deltaC * deltaH;
	
	return sqrt(delta_E_squared);
}

vec3 rgb2xyz(vec3 c) {
	vec3 tmp;
	tmp.x = (c.r > 0.04045) ? pow((c.r + 0.055) / 1.055, 2.4) : c.r / 12.92;
	tmp.y = (c.g > 0.04045) ? pow((c.g + 0.055) / 1.055, 2.4) : c.g / 12.92;
	tmp.z = (c.b > 0.04045) ? pow((c.b + 0.055) / 1.055, 2.4) : c.b / 12.92;
	return 100.0 * tmp * mat3(0.4124, 0.3576, 0.1805, 0.2126, 0.7152, 0.0722, 0.0193, 0.1192, 0.9505);
}
vec3 xyz2lab(vec3 c) {
	vec3 n = c / vec3(95.047, 100.0, 108.883);
	vec3 v;
	v.x = (n.x > 0.008856) ? pow(n.x, 1.0 / 3.0) : (7.787 * n.x) + (16.0 / 116.0);
	v.y = (n.y > 0.008856) ? pow(n.y, 1.0 / 3.0) : (7.787 * n.y) + (16.0 / 116.0);
	v.z = (n.z > 0.008856) ? pow(n.z, 1.0 / 3.0) : (7.787 * n.z) + (16.0 / 116.0);
	return vec3((116.0 * v.y) - 16.0, 500.0 * (v.x - v.y), 200.0 * (v.y - v.z));
}

vec3 rgb2lab(vec3 c) {
	vec3 lab = xyz2lab(rgb2xyz(c));
	return vec3(lab.x / 100.0, 0.5 + 0.5 * (lab.y / 127.0), 0.5 + 0.5 * (lab.z / 127.0));
}


float compare(vec3 rgb1, vec3 rgb2) {
	vec3 lab1 = rgb2lab(rgb1);
	vec3 lab2 = rgb2lab(rgb2);
	return calculate_CIEDE2000(lab1, lab2);
}
`;

const CONVERSION_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform sampler2D tPalette;
uniform float uPaletteSize;
uniform sampler2D tInput;
uniform vec2 uInputSize;
uniform vec2 uOutputSize;

${CIEDE2000}

void main() {
	vec4 pixel = texture2D(tInput, vUv);
	
	int best_i = 0;
	float best_score = 100000000.0;
	int max_i = int(uPaletteSize);
	for (int i = 0; i < 256; i++) {
		if (i > max_i) {
			break;
		}

		vec4 palette = texture2D(tPalette, vec2(float(i) / uPaletteSize, 0.0));

		if (palette.a < 1.0) {
			continue;
		}

		float score = compare(pixel.rgb, palette.rgb);
		// NOTE: must be <= so that we match the last idenifcal color
		// see palette for why
		if (score <= best_score) {
			best_score = score;
			best_i = i;
		}
	}

	gl_FragColor = vec4(float(best_i) / uPaletteSize);
	gl_FragColor.a = pixel.a == 0.0 ? 0.0 : 1.0;
}
`;

export class ConversionProgram extends Program {
	public readonly uniforms: ConversionUniforms;

	constructor(gl: OGLRenderingContext) {
		super(gl, {
			vertex: QUAD_VERTEX_SHADER,
			fragment: CONVERSION_FRAGMENT_SHADER,
			transparent: true,
		});

		this.uniforms = {
			uView: { value: new Mat3().identity() },
			uAspect: { value: new Vec2(1, 1) },
			tPalette: { value: new Texture(gl) },
			uPaletteSize: { value: 1 },
			tInput: { value: new Texture(gl) },
			uInputSize: { value: new Vec2(1, 1) },
			uOutputSize: { value: new Vec2(1, 1) },
		} as ConversionUniforms;
	}
}

export enum Conversion {
	CIEDE2000,
}
