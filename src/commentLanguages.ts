interface CommentLanguage {
  grammar: string;
  style: 'go' | 'jsdoc' | 'python' | 'doxygen' | 'xml' | 'rust' | 'ruby';
  declarations: readonly string[];
  wrappers?: readonly string[];
}

const typescript: CommentLanguage = {
  grammar: 'typescript',
  style: 'jsdoc',
  declarations: [
    'function_declaration',
    'function_signature',
    'class_declaration',
    'abstract_class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'enum_assignment',
    'variable_declarator',
    'method_definition',
    'method_signature',
    'abstract_method_signature',
    'public_field_definition',
    'property_signature',
    'field_definition',
    'pair',
    'shorthand_property_identifier',
  ],
  wrappers: [
    'export_statement',
    'ambient_declaration',
    'lexical_declaration',
    'variable_declaration',
  ],
};

const javascript: CommentLanguage = { ...typescript, grammar: 'javascript' };

const cpp: CommentLanguage = {
  grammar: 'cpp',
  style: 'doxygen',
  declarations: [
    'function_definition',
    'declaration',
    'field_declaration',
    'type_definition',
    'alias_declaration',
    'class_specifier',
    'struct_specifier',
    'union_specifier',
    'enum_specifier',
    'enumerator',
    'namespace_definition',
    'preproc_def',
    'preproc_function_def',
  ],
  wrappers: ['template_declaration', 'export_statement'],
};

/** Source language rules used by both hover registration and declaration parsing. */
export const commentLanguages: Readonly<Record<string, CommentLanguage>> = {
  go: {
    grammar: 'go',
    style: 'go',
    declarations: [
      'function_declaration',
      'method_declaration',
      'type_spec',
      'type_alias',
      'field_declaration',
      'method_elem',
      'var_spec',
      'const_spec',
    ],
    wrappers: ['type_declaration', 'var_declaration', 'const_declaration', 'var_spec_list'],
  },
  typescript,
  typescriptreact: { ...typescript, grammar: 'tsx' },
  javascript,
  javascriptreact: javascript,
  python: {
    grammar: 'python',
    style: 'python',
    declarations: ['function_definition', 'class_definition'],
    wrappers: ['decorated_definition'],
  },
  java: {
    grammar: 'java',
    style: 'jsdoc',
    declarations: [
      'class_declaration',
      'interface_declaration',
      'enum_declaration',
      'record_declaration',
      'annotation_type_declaration',
      'annotation_type_element_declaration',
      'method_declaration',
      'constructor_declaration',
      'compact_constructor_declaration',
      'variable_declarator',
      'enum_constant',
    ],
    wrappers: ['field_declaration', 'constant_declaration', 'local_variable_declaration'],
  },
  c: cpp,
  cpp,
  csharp: {
    grammar: 'c-sharp',
    style: 'xml',
    declarations: [
      'class_declaration',
      'struct_declaration',
      'interface_declaration',
      'record_declaration',
      'enum_declaration',
      'enum_member_declaration',
      'delegate_declaration',
      'method_declaration',
      'constructor_declaration',
      'property_declaration',
      'event_declaration',
      'variable_declarator',
    ],
    wrappers: ['variable_declaration', 'field_declaration', 'event_field_declaration'],
  },
  rust: {
    grammar: 'rust',
    style: 'rust',
    declarations: [
      'function_item',
      'function_signature_item',
      'struct_item',
      'enum_item',
      'enum_variant',
      'trait_item',
      'type_item',
      'const_item',
      'static_item',
      'mod_item',
      'union_item',
      'field_declaration',
      'associated_type',
      'macro_definition',
    ],
  },
  php: {
    grammar: 'php',
    style: 'jsdoc',
    declarations: [
      'class_declaration',
      'interface_declaration',
      'trait_declaration',
      'enum_declaration',
      'enum_case',
      'function_definition',
      'method_declaration',
      'property_element',
      'const_element',
    ],
    wrappers: ['property_declaration', 'const_declaration'],
  },
  ruby: {
    grammar: 'ruby',
    style: 'ruby',
    declarations: ['class', 'module', 'method', 'singleton_method', 'assignment', 'call'],
    wrappers: ['body_statement'],
  },
};
