import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Tests to validate TypeScript syntax errors found in route files
 */
describe('Route File Syntax Validation', () => {
  
  function checkTypeScriptSyntax(filePath: string): ts.Diagnostic[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.ES2020,
      true
    );
    
    const diagnostics: ts.Diagnostic[] = [];
    
    // Check for syntax errors
    const syntacticDiagnostics = ts.getPreEmitDiagnostics(
      ts.createProgram([filePath], {
        noEmit: true,
        allowJs: false,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        skipLibCheck: true
      })
    );
    
    return syntacticDiagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
  }
  
  describe('Auth Route Validation', () => {
    const authPath = path.join(__dirname, '../../../src/api/routes/auth.ts');
    
    it('should not have syntax errors at line 427', () => {
      const content = fs.readFileSync(authPath, 'utf-8');
      const lines = content.split('\n');
      
      // Check line 427 context
      expect(lines[426]).toBeDefined(); // line 427 in 0-indexed array
      
      // The line should not be a standalone closing parenthesis
      const line427 = lines[426].trim();
      if (line427 === ');') {
        throw new Error('Line 427 contains a standalone closing parenthesis - likely a syntax error');
      }
    });
    
    it('should not have syntax errors at line 536', () => {
      const content = fs.readFileSync(authPath, 'utf-8');
      const lines = content.split('\n');
      
      const line536 = lines[535]?.trim();
      if (line536 === ');') {
        throw new Error('Line 536 contains a standalone closing parenthesis - likely a syntax error');
      }
    });
    
    it('should not have syntax errors at line 572', () => {
      const content = fs.readFileSync(authPath, 'utf-8');
      const lines = content.split('\n');
      
      const line572 = lines[571]?.trim();
      if (line572 === ');') {
        throw new Error('Line 572 contains a standalone closing parenthesis - likely a syntax error');
      }
    });
    
    it('should not have syntax errors at line 633', () => {
      const content = fs.readFileSync(authPath, 'utf-8');
      const lines = content.split('\n');
      
      const line633 = lines[632]?.trim();
      if (line633 === ');') {
        throw new Error('Line 633 contains a standalone closing parenthesis - likely a syntax error');
      }
    });
  });
  
  describe('Ingestion Route Validation', () => {
    const ingestionPath = path.join(__dirname, '../../../src/api/routes/ingestion.ts');
    
    it('should not have syntax errors at line 555', () => {
      const content = fs.readFileSync(ingestionPath, 'utf-8');
      const lines = content.split('\n');
      
      const line555 = lines[554]?.trim();
      if (line555 === ');') {
        throw new Error('Line 555 contains a standalone closing parenthesis - likely a syntax error');
      }
    });
    
    it('should not have syntax errors at line 618', () => {
      const content = fs.readFileSync(ingestionPath, 'utf-8');
      const lines = content.split('\n');
      
      const line618 = lines[617]?.trim();
      if (line618 === ');') {
        throw new Error('Line 618 contains a standalone closing parenthesis - likely a syntax error');
      }
    });
  });
  
  describe('Query Route Validation', () => {
    const queryPath = path.join(__dirname, '../../../src/api/routes/query.ts');
    
    const errorLines = [132, 170, 211, 237, 285, 311];
    
    errorLines.forEach(lineNum => {
      it(`should not have syntax errors at line ${lineNum}`, () => {
        const content = fs.readFileSync(queryPath, 'utf-8');
        const lines = content.split('\n');
        
        const line = lines[lineNum - 1]?.trim();
        if (line === ');') {
          throw new Error(`Line ${lineNum} contains a standalone closing parenthesis - likely a syntax error`);
        }
      });
    });
  });
  
  describe('Overall TypeScript Compilation', () => {
    it('should compile all route files without errors', () => {
      const routeFiles = [
        path.join(__dirname, '../../../src/api/routes/auth.ts'),
        path.join(__dirname, '../../../src/api/routes/ingestion.ts'),
        path.join(__dirname, '../../../src/api/routes/query.ts')
      ];
      
      const program = ts.createProgram(routeFiles, {
        noEmit: true,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        skipLibCheck: true,
        strict: true
      });
      
      const diagnostics = ts.getPreEmitDiagnostics(program);
      const errors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
      
      if (errors.length > 0) {
        const errorMessages = errors.map(e => {
          const file = e.file;
          if (file) {
            const { line, character } = file.getLineAndCharacterOfPosition(e.start!);
            return `${file.fileName}:${line + 1}:${character + 1} - ${ts.flattenDiagnosticMessageText(e.messageText, '\n')}`;
          }
          return ts.flattenDiagnosticMessageText(e.messageText, '\n');
        });
        
        throw new Error(`TypeScript compilation errors found:\n${errorMessages.join('\n')}`);
      }
    });
  });
});