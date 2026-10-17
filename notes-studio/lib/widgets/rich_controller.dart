import 'package:flutter/material.dart';

import '../logic/editor_logic.dart';

/// Controller che mostra la formattazione Markdown in linea mentre si scrive:
/// **grassetto**, *corsivo*, ~~barrato~~ e `codice`. I marcatori restano nel
/// testo (così l'esportazione Markdown è fedele) ma vengono attenuati.
class RichTextController extends TextEditingController {
  RichTextController({super.text});

  Color markerColor = Colors.grey;
  Color codeBackground = const Color(0x11000000);
  Color codeColor = const Color(0xFFEB5757);

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    // Durante la composizione (tastiere predittive) lasciamo fare a Flutter.
    if (withComposing && value.isComposingRangeValid) {
      return super.buildTextSpan(
        context: context,
        style: style,
        withComposing: withComposing,
      );
    }
    final segs = parseInline(text);
    if (segs.length <= 1) return TextSpan(style: style, text: text);
    return TextSpan(
      style: style,
      children: [
        for (final s in segs)
          TextSpan(
            text: s.text,
            style: s.marker
                ? TextStyle(color: markerColor, fontWeight: FontWeight.w300)
                : TextStyle(
                    fontWeight: s.bold ? FontWeight.w700 : null,
                    fontStyle: s.italic ? FontStyle.italic : null,
                    decoration: s.strike ? TextDecoration.lineThrough : null,
                    fontFamily: s.code ? 'monospace' : null,
                    color: s.code ? codeColor : null,
                    backgroundColor: s.code ? codeBackground : null,
                  ),
          ),
      ],
    );
  }
}
