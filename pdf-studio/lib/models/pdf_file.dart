import 'dart:typed_data';

/// Un documento PDF aperto in memoria.
class PdfFile {
  PdfFile({required this.name, required this.bytes, this.path});

  final String name;
  final Uint8List bytes;

  /// Percorso nella libreria dell'app (null sul web).
  final String? path;

  PdfFile copyWith({String? name, Uint8List? bytes, String? path}) => PdfFile(
        name: name ?? this.name,
        bytes: bytes ?? this.bytes,
        path: path ?? this.path,
      );
}

/// Voce della lista "Recenti".
class RecentEntry {
  RecentEntry({
    required this.name,
    required this.path,
    required this.openedAt,
    this.favorite = false,
    this.lastPage = 1,
  });

  final String name;
  final String path;
  final DateTime openedAt;
  final bool favorite;
  final int lastPage;

  RecentEntry copyWith({String? name, String? path, DateTime? openedAt, bool? favorite, int? lastPage}) =>
      RecentEntry(
        name: name ?? this.name,
        path: path ?? this.path,
        openedAt: openedAt ?? this.openedAt,
        favorite: favorite ?? this.favorite,
        lastPage: lastPage ?? this.lastPage,
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'path': path,
        'openedAt': openedAt.toIso8601String(),
        'favorite': favorite,
        'lastPage': lastPage,
      };

  factory RecentEntry.fromJson(Map<String, dynamic> j) => RecentEntry(
        name: j['name'] as String,
        path: j['path'] as String,
        openedAt: DateTime.tryParse(j['openedAt'] as String? ?? '') ?? DateTime.now(),
        favorite: j['favorite'] as bool? ?? false,
        lastPage: j['lastPage'] as int? ?? 1,
      );
}
