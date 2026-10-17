import 'package:uuid/uuid.dart';

const _uuid = Uuid();

String newId() => _uuid.v4();

/// Tipi di blocco disponibili nell'editor, come in Notion.
enum BlockType {
  text,
  h1,
  h2,
  h3,
  bullet,
  numbered,
  todo,
  toggle,
  quote,
  callout,
  code,
  divider,
  page,
}

extension BlockTypeInfo on BlockType {
  /// Tipi che contengono testo modificabile.
  bool get hasText => this != BlockType.divider && this != BlockType.page;

  /// Tipi "lista": premendo Invio si crea un altro blocco dello stesso tipo.
  bool get continuesOnEnter =>
      this == BlockType.bullet ||
      this == BlockType.numbered ||
      this == BlockType.todo;

  bool get isHeading =>
      this == BlockType.h1 || this == BlockType.h2 || this == BlockType.h3;
}

/// Colori del testo/sfondo di un blocco (palette di Notion).
enum BlockColor {
  none,
  gray,
  brown,
  orange,
  yellow,
  green,
  blue,
  purple,
  pink,
  red,
}

class Block {
  Block({
    String? id,
    this.type = BlockType.text,
    this.text = '',
    this.checked = false,
    this.collapsed = false,
    this.indent = 0,
    this.pageId,
    this.emoji,
    this.color = BlockColor.none,
  }) : id = id ?? newId();

  final String id;
  BlockType type;
  String text;
  bool checked;
  bool collapsed;
  int indent;

  /// Pagina collegata (solo per i blocchi [BlockType.page]).
  String? pageId;

  /// Emoji del callout.
  String? emoji;
  BlockColor color;

  static const maxIndent = 6;

  Block copy({bool newIdentity = true}) => Block(
    id: newIdentity ? null : id,
    type: type,
    text: text,
    checked: checked,
    collapsed: collapsed,
    indent: indent,
    pageId: pageId,
    emoji: emoji,
    color: color,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    't': type.name,
    if (text.isNotEmpty) 'x': text,
    if (checked) 'c': true,
    if (collapsed) 'col': true,
    if (indent > 0) 'i': indent,
    if (pageId != null) 'p': pageId,
    if (emoji != null) 'e': emoji,
    if (color != BlockColor.none) 'k': color.name,
  };

  factory Block.fromJson(Map<String, dynamic> j) => Block(
    id: j['id'] as String?,
    type: BlockType.values.asNameMap()[j['t']] ?? BlockType.text,
    text: j['x'] as String? ?? '',
    checked: j['c'] as bool? ?? false,
    collapsed: j['col'] as bool? ?? false,
    indent: j['i'] as int? ?? 0,
    pageId: j['p'] as String?,
    emoji: j['e'] as String?,
    color: BlockColor.values.asNameMap()[j['k']] ?? BlockColor.none,
  );
}
