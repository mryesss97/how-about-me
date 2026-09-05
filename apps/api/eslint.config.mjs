import nest from "@how-about-me/eslint-config/nest";
export default [...nest, { ignores: ["dist/**", "coverage/**", "src/generated/**"] }];
