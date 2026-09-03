import { describe, expect, it } from 'vitest';
import { explainProblem, explainProblems } from './problems';

describe('what the reader is told a problem is', () => {
  it('names the field, not the array index it lives at', () => {
    // `tools.0.name` is the right thing to tell a JSON author and the wrong
    // thing to put in front of someone looking at a form.
    const problem = explainProblem('tools.0.name: String must contain at least 1 character(s)');
    expect(problem).toEqual({ field: 'toolName', key: 'studio.problemToolName', params: [] });
  });

  it('tells apart "nothing typed" from "that will not do"', () => {
    const empty = explainProblem('tools.0.name: String must contain at least 1 character(s)');
    const shape = explainProblem('tools.0.name: tool names must be snake_case');
    expect(shape.key).not.toBe(empty.key);
    expect(shape.key).toBe('studio.problemToolNameCase');
  });

  it('points at the description, which is the field an agent reads', () => {
    const problem = explainProblem('tools.0.description: String must contain at least 1 character(s)');
    expect(problem.field).toBe('toolDescription');
  });

  it('numbers a step from one, the way the flow does', () => {
    const problem = explainProblem('tools.0.steps.2.selector: Required');
    expect(problem).toEqual({ key: 'studio.problemStep', params: [3, 'Required'] });
  });

  it('carries the schema’s own words for anything it does not know, without the path', () => {
    const problem = explainProblem('tools.0.inputSchema.properties: Unrecognised key');
    expect(problem).toEqual({ key: 'studio.problemRaw', params: ['Unrecognised key'] });
  });

  it('maps the adapter’s own fields too', () => {
    expect(explainProblem('id: Invalid').field).toBe('adapterId');
    expect(explainProblem('version: Invalid').field).toBe('version');
    expect(explainProblem('origins.0: must be an exact origin').field).toBe('origin');
  });

  it('survives an error with no path at all', () => {
    expect(explainProblem('duplicate tool names').params).toEqual(['duplicate tool names']);
    expect(explainProblems([])).toEqual([]);
  });
});
