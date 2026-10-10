import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models/pdf_file.dart';

/// Stato globale: tema, recenti/preferiti e firma salvata.
class AppState extends ChangeNotifier {
  ThemeMode themeMode = ThemeMode.system;
  List<RecentEntry> recents = [];
  Uint8List? savedSignature;
  SharedPreferences? _prefs;

  Future<void> load() async {
    try {
      _prefs = await SharedPreferences.getInstance();
    } catch (_) {
      return;
    }
    final p = _prefs!;
    themeMode = ThemeMode.values.firstWhere(
      (m) => m.name == p.getString('theme'),
      orElse: () => ThemeMode.system,
    );
    recents = (p.getStringList('recents') ?? [])
        .map((s) {
          try {
            return RecentEntry.fromJson(jsonDecode(s) as Map<String, dynamic>);
          } catch (_) {
            return null;
          }
        })
        .whereType<RecentEntry>()
        .toList();
    final sig = p.getString('signature');
    if (sig != null) savedSignature = base64Decode(sig);
  }

  void setTheme(ThemeMode mode) {
    themeMode = mode;
    _prefs?.setString('theme', mode.name);
    notifyListeners();
  }

  RecentEntry? recentFor(String path) {
    for (final r in recents) {
      if (r.path == path) return r;
    }
    return null;
  }

  Future<void> addRecent(String name, String path, {int? lastPage}) async {
    final old = recentFor(path);
    recents.removeWhere((r) => r.path == path);
    recents.insert(
      0,
      RecentEntry(
        name: name,
        path: path,
        openedAt: DateTime.now(),
        favorite: old?.favorite ?? false,
        lastPage: lastPage ?? old?.lastPage ?? 1,
      ),
    );
    if (recents.length > 50) recents = recents.sublist(0, 50);
    await _saveRecents();
  }

  Future<void> setLastPage(String path, int page) async {
    final i = recents.indexWhere((r) => r.path == path);
    if (i < 0) return;
    recents[i] = recents[i].copyWith(lastPage: page);
    await _saveRecents();
  }

  Future<void> toggleFavorite(String path) async {
    final i = recents.indexWhere((r) => r.path == path);
    if (i < 0) return;
    recents[i] = recents[i].copyWith(favorite: !recents[i].favorite);
    await _saveRecents();
  }

  Future<void> renameRecent(String oldPath, String newPath, String newName) async {
    final i = recents.indexWhere((r) => r.path == oldPath);
    if (i < 0) return;
    recents[i] = recents[i].copyWith(path: newPath, name: newName);
    await _saveRecents();
  }

  Future<void> removeRecent(String path) async {
    recents.removeWhere((r) => r.path == path);
    await _saveRecents();
  }

  Future<void> setSignature(Uint8List? png) async {
    savedSignature = png;
    if (png == null) {
      await _prefs?.remove('signature');
    } else {
      await _prefs?.setString('signature', base64Encode(png));
    }
    notifyListeners();
  }

  Future<void> _saveRecents() async {
    notifyListeners();
    await _prefs?.setStringList(
      'recents',
      recents.map((r) => jsonEncode(r.toJson())).toList(),
    );
  }
}
