#! /usr/bin/env tsx

import { writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const INPUT_FILE = process.argv[2];
const OUTPUT_FILE = process.argv[3];

if (!INPUT_FILE || !OUTPUT_FILE) {
  console.log("Example usage: yoink-ts input.mjs output.ts");
  throw new Error("Please provide input and output file names as arguments");
}

const exportName = INPUT_FILE.split(".")[0]!;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = ts.createProgram([INPUT_FILE, OUTPUT_FILE], {
  module: ts.ModuleKind.Node16,
  rootDir: __dirname,
  allowJs: true,
});
const sourceFile = program.getSourceFile("inlinedEnv.mjs");

if (!sourceFile) {
  throw new Error("Could not load source file");
}

const variableDeclaration = sourceFile.statements.filter(
  ts.isVariableStatement
)[0]!.declarationList.declarations[0]!;

const variableName = ts.isIdentifier(variableDeclaration.name)
  ? variableDeclaration.name.text
  : undefined;
if (variableName !== exportName) {
  throw new Error("unexpected export name");
}
if (!variableDeclaration.initializer) {
  throw new Error("initializer is missing");
}

const checker = program.getTypeChecker();
const type = checker.getTypeAtLocation(variableDeclaration.initializer);

const typeNode = checker.typeToTypeNode(
  type,
  undefined,
  ts.NodeBuilderFlags.NoTruncation
);
if (!typeNode || !ts.isTypeLiteralNode(typeNode)) {
  throw new Error("Expected type literal node");
}
const members = typeNode.members;

const output = program.getSourceFile(OUTPUT_FILE)!;
const outputTypeName = exportName[0]!.toUpperCase() + exportName.slice(1);

const interfaceDeclaration = output.statements.find(
  (node): node is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(node) && node.name.text === outputTypeName
);
if (!interfaceDeclaration) {
  throw new Error(`Could not find interface ${outputTypeName}`);
}

const printer = ts.createPrinter();

const {
  transformed: [res],
  diagnostics,
} = ts.transform(output, [
  (ctx) =>
    (rootNode): ts.SourceFile => {
      const visit = (node: ts.Node): ts.Node => {
        if (
          ts.isInterfaceDeclaration(node) &&
          node.name.text === outputTypeName
        ) {
          const res = ctx.factory.updateInterfaceDeclaration(
            node,
            node.modifiers,
            node.name,
            node.typeParameters,
            node.heritageClauses,
            members
          );

          return res;
        }

        return ts.visitEachChild(node, visit, ctx);
      };

      return ts.visitNode(rootNode, visit, ts.isSourceFile);
    },
]);

if (!res) {
  console.error(diagnostics);
  throw new Error("Could not transform source file");
}

writeFileSync(OUTPUT_FILE, printer.printFile(res));
