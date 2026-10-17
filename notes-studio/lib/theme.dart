import 'package:flutter/material.dart';

import 'models/block.dart';

/// Colori "alla Notion" per tema chiaro e scuro.
class NotionColors extends ThemeExtension<NotionColors> {
  const NotionColors({
    required this.text,
    required this.secondary,
    required this.faint,
    required this.sidebar,
    required this.hover,
    required this.codeBg,
    required this.border,
  });

  final Color text;
  final Color secondary;
  final Color faint;
  final Color sidebar;
  final Color hover;
  final Color codeBg;
  final Color border;

  static const light = NotionColors(
    text: Color(0xFF37352F),
    secondary: Color(0xFF787774),
    faint: Color(0xFFB4B4B0),
    sidebar: Color(0xFFF7F7F5),
    hover: Color(0x0F37352F),
    codeBg: Color(0xFFF7F6F3),
    border: Color(0xFFE9E9E7),
  );

  static const dark = NotionColors(
    text: Color(0xFFD4D4D4),
    secondary: Color(0xFF9B9B9B),
    faint: Color(0xFF5A5A5A),
    sidebar: Color(0xFF202020),
    hover: Color(0x14FFFFFF),
    codeBg: Color(0xFF2A2A2A),
    border: Color(0xFF2F2F2F),
  );

  static NotionColors of(BuildContext context) =>
      Theme.of(context).extension<NotionColors>()!;

  @override
  NotionColors copyWith() => this;

  @override
  NotionColors lerp(NotionColors? other, double t) => t < 0.5 ? this : other!;
}

ThemeData buildTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final c = dark ? NotionColors.dark : NotionColors.light;
  final bg = dark ? const Color(0xFF191919) : Colors.white;
  final scheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFF2383E2),
    brightness: brightness,
  ).copyWith(surface: bg, onSurface: c.text, primary: const Color(0xFF2383E2));
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    extensions: [c],
    appBarTheme: AppBarTheme(
      backgroundColor: bg,
      foregroundColor: c.text,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0.5,
    ),
    drawerTheme: DrawerThemeData(backgroundColor: c.sidebar),
    dividerTheme: DividerThemeData(color: c.border, space: 1),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: dark ? const Color(0xFF252525) : Colors.white,
      surfaceTintColor: Colors.transparent,
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: dark ? const Color(0xFF252525) : Colors.white,
      surfaceTintColor: Colors.transparent,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: dark ? const Color(0xFF252525) : Colors.white,
      surfaceTintColor: Colors.transparent,
    ),
    textTheme: Typography.material2021(platform: TargetPlatform.android).black
        .apply(bodyColor: c.text, displayColor: c.text),
  );
}

/// Copertine: gradienti predefiniti.
const coverGradients = <List<Color>>[
  [Color(0xFFFFB199), Color(0xFFFF0844)],
  [Color(0xFF667EEA), Color(0xFF764BA2)],
  [Color(0xFFF6D365), Color(0xFFFDA085)],
  [Color(0xFF84FAB0), Color(0xFF8FD3F4)],
  [Color(0xFFA18CD1), Color(0xFFFBC2EB)],
  [Color(0xFFFCCB90), Color(0xFFD57EEB)],
  [Color(0xFF43E97B), Color(0xFF38F9D7)],
  [Color(0xFF30CFD0), Color(0xFF330867)],
  [Color(0xFFE0C3FC), Color(0xFF8EC5FC)],
  [Color(0xFF0BA360), Color(0xFF3CBA92)],
  [Color(0xFF232526), Color(0xFF414345)],
  [Color(0xFFFF9A9E), Color(0xFFFAD0C4)],
];

/// Colore del testo per un [BlockColor].
Color? blockTextColor(BlockColor c, bool dark) => switch (c) {
  BlockColor.none => null,
  BlockColor.gray => dark ? const Color(0xFF9B9B9B) : const Color(0xFF787774),
  BlockColor.brown => dark ? const Color(0xFFBA856F) : const Color(0xFF9F6B53),
  BlockColor.orange => dark ? const Color(0xFFC77D48) : const Color(0xFFD9730D),
  BlockColor.yellow => dark ? const Color(0xFFCA9849) : const Color(0xFFCB912F),
  BlockColor.green => dark ? const Color(0xFF529E72) : const Color(0xFF448361),
  BlockColor.blue => dark ? const Color(0xFF5E87C9) : const Color(0xFF337EA9),
  BlockColor.purple => dark ? const Color(0xFF9D68D3) : const Color(0xFF9065B0),
  BlockColor.pink => dark ? const Color(0xFFD15796) : const Color(0xFFC14C8A),
  BlockColor.red => dark ? const Color(0xFFDF5452) : const Color(0xFFD44C47),
};

/// Colore di sfondo per un [BlockColor] (usato dai callout).
Color blockBackground(BlockColor c, bool dark) => switch (c) {
  BlockColor.none ||
  BlockColor.gray => dark ? const Color(0xFF2F2F2F) : const Color(0xFFF1F1EF),
  BlockColor.brown => dark ? const Color(0xFF4A3228) : const Color(0xFFF4EEEE),
  BlockColor.orange => dark ? const Color(0xFF5C3B23) : const Color(0xFFFBECDD),
  BlockColor.yellow => dark ? const Color(0xFF564328) : const Color(0xFFFBF3DB),
  BlockColor.green => dark ? const Color(0xFF243D30) : const Color(0xFFEDF3EC),
  BlockColor.blue => dark ? const Color(0xFF143A4E) : const Color(0xFFE7F3F8),
  BlockColor.purple => dark ? const Color(0xFF3C2D49) : const Color(0xFFF6F3F9),
  BlockColor.pink => dark ? const Color(0xFF4E2C3C) : const Color(0xFFFAF1F5),
  BlockColor.red => dark ? const Color(0xFF522E2A) : const Color(0xFFFDEBEC),
};

const blockColorNames = {
  BlockColor.none: 'Predefinito',
  BlockColor.gray: 'Grigio',
  BlockColor.brown: 'Marrone',
  BlockColor.orange: 'Arancione',
  BlockColor.yellow: 'Giallo',
  BlockColor.green: 'Verde',
  BlockColor.blue: 'Blu',
  BlockColor.purple: 'Viola',
  BlockColor.pink: 'Rosa',
  BlockColor.red: 'Rosso',
};
