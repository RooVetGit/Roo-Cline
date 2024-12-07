import { parseAssistantMessage } from '../parse-assistant-message'
import { ToolUseName } from '../'

describe('parseAssistantMessage', () => {
  it('should parse plain text', () => {
    const input = 'Hello, this is a simple message'
    const result = parseAssistantMessage(input)

    expect(result).toEqual([{
      type: 'text',
      content: 'Hello, this is a simple message',
      partial: true
    }])
  })

  it('should parse a tool use with parameters', () => {
    const input = '<write_to_file><path>test.txt</path><content>Hello World</content></write_to_file>'
    const result = parseAssistantMessage(input)

    expect(result).toEqual([{
      type: 'tool_use',
      name: 'write_to_file' as ToolUseName,
      params: {
        path: 'test.txt',
        content: 'Hello World'
      },
      partial: false
    }])
  })

  it('should parse mixed text and tool use', () => {
    const input = '<thinking>Let me write a file for you: </thinking><write_to_file><path>test.txt</path><content>Hello World</content></write_to_file> Done!'
    const result = parseAssistantMessage(input)

    expect(result).toEqual([
      {
        type: 'text',
        content: '<thinking>Let me write a file for you: </thinking>',
        partial: false
      },
      {
        type: 'tool_use',
        name: 'write_to_file' as ToolUseName,
        params: {
          path: 'test.txt',
          content: 'Hello World'
        },
        partial: false
      },
      {
        type: 'text',
        content: 'Done!',
        partial: true
      }
    ])
  })

  it('should handle nested tags in content parameter', () => {
    const input = '<write_to_file><path>test.txt</path><content>function test() { return </content>; }</content></write_to_file>'
    const result = parseAssistantMessage(input)

    expect(result).toEqual([{
      type: 'tool_use',
      name: 'write_to_file' as ToolUseName,
      params: {
        path: 'test.txt',
        content: 'function test() { return </content>; }'
      },
      partial: false
    }])
  })

  it("should handle multiple nested tags correctly", () => {
    const input = `
      <write_to_file>
        <path>output.txt</path>
        <content>
          <write_to_file><path>input.txt</path><content>Hello World</content></write_to_file>
          More content
        </content>
      </write_to_file>`
    const result = parseAssistantMessage(input)

    expect(result).toEqual([{
      type: 'tool_use',
      name: 'write_to_file' as ToolUseName,
      params: {
        path: 'output.txt',
        content:
`<write_to_file><path>input.txt</path><content>Hello World</content></write_to_file>
          More content`
      },
      partial: false
    }])
  });

  it('should handle partial tool use', () => {
    const input = 'Starting... <write_to_file><path>test.txt</path><content>partial'
    const result = parseAssistantMessage(input)

    expect(result).toEqual([
      {
        type: 'text',
        content: 'Starting...',
        partial: false
      },
      {
        type: 'tool_use',
        name: 'write_to_file' as ToolUseName,
        params: {
          path: 'test.txt',
          content: 'partial'
        },
        partial: true
      }
    ])
  })
})