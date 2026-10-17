import 'block.dart';

class NotePage {
  NotePage({
    String? id,
    this.parentId,
    this.title = '',
    this.icon = '',
    this.cover,
    List<Block>? blocks,
    this.favorite = false,
    this.trashed = false,
    this.fullWidth = false,
    int? createdAt,
    int? updatedAt,
  }) : id = id ?? newId(),
       blocks = blocks ?? [Block()],
       createdAt = createdAt ?? DateTime.now().millisecondsSinceEpoch,
       updatedAt = updatedAt ?? DateTime.now().millisecondsSinceEpoch;

  final String id;
  String? parentId;
  String title;

  /// Emoji usata come icona ('' = nessuna).
  String icon;

  /// Indice nella palette delle copertine (null = nessuna copertina).
  int? cover;
  List<Block> blocks;
  bool favorite;
  bool trashed;
  bool fullWidth;
  final int createdAt;
  int updatedAt;

  String get displayTitle => title.trim().isEmpty ? 'Senza titolo' : title;

  Map<String, dynamic> toJson() => {
    'id': id,
    if (parentId != null) 'parent': parentId,
    'title': title,
    if (icon.isNotEmpty) 'icon': icon,
    if (cover != null) 'cover': cover,
    'blocks': blocks.map((b) => b.toJson()).toList(),
    if (favorite) 'fav': true,
    if (trashed) 'trash': true,
    if (fullWidth) 'wide': true,
    'created': createdAt,
    'updated': updatedAt,
  };

  factory NotePage.fromJson(Map<String, dynamic> j) => NotePage(
    id: j['id'] as String?,
    parentId: j['parent'] as String?,
    title: j['title'] as String? ?? '',
    icon: j['icon'] as String? ?? '',
    cover: j['cover'] as int?,
    blocks: (j['blocks'] as List? ?? [])
        .map((b) => Block.fromJson(Map<String, dynamic>.from(b as Map)))
        .toList(),
    favorite: j['fav'] as bool? ?? false,
    trashed: j['trash'] as bool? ?? false,
    fullWidth: j['wide'] as bool? ?? false,
    createdAt: j['created'] as int?,
    updatedAt: j['updated'] as int?,
  );
}
