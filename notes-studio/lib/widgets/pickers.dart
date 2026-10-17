import 'package:flutter/material.dart';

import '../logic/editor_logic.dart';
import '../theme.dart';

const _emojiGroups = <String, String>{
  'Frequenti': '📄 📝 ✅ 💡 🚀 📚 🎯 📌 ⭐ 🔥 ❤️ 👋 🗓️ 📅 📔 🍝 ⏱️ 🧠',
  'Lavoro': '💼 📊 📈 📉 🗂️ 📁 🧾 📎 🖇️ ✏️ 🖊️ 📐 🧮 💻 🖥️ ⌨️ 📱 ☎️ 📧 🏢',
  'Casa': '🏠 🛒 🧺 🧹 🍳 🍕 🍔 🥗 ☕ 🍷 🛏️ 🛋️ 🪴 🐶 🐱 🚗 ✈️ 🏖️ ⛰️ 🎄',
  'Persone':
      '😀 😎 🤓 🥳 😴 🤔 🙌 👍 💪 🧘 🏃 👨‍💻 👩‍💻 👨‍🍳 🧑‍🎨 👪 🤝 🙏 👀 💬',
  'Simboli': '✨ 🎉 🎁 🏆 🔔 🔒 🔑 ⚙️ 🛠️ 🔧 🧩 🎨 🎵 🎮 📷 🎬 🌈 ☀️ 🌙 ⚡',
  'Natura': '🌱 🌳 🌸 🌻 🍀 🍁 🌊 🔥 ❄️ 🌍 🦋 🐝 🐢 🦊 🐉 🍎 🍋 🍇 🥑 🌶️',
};

/// Mostra il selettore di emoji. Restituisce '' per rimuovere l'icona.
Future<String?> pickEmoji(BuildContext context, {bool allowRemove = true}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      builder: (ctx, scroll) => ListView(
        controller: scroll,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          Row(
            children: [
              Text('Icona', style: Theme.of(ctx).textTheme.titleMedium),
              const Spacer(),
              if (allowRemove)
                TextButton(
                  onPressed: () => Navigator.pop(ctx, ''),
                  child: const Text('Rimuovi'),
                ),
            ],
          ),
          for (final g in _emojiGroups.entries) ...[
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 4),
              child: Text(
                g.key,
                style: TextStyle(
                  color: NotionColors.of(ctx).secondary,
                  fontSize: 12,
                ),
              ),
            ),
            Wrap(
              children: [
                for (final e in g.value.split(' '))
                  InkWell(
                    borderRadius: BorderRadius.circular(6),
                    onTap: () => Navigator.pop(ctx, e),
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(
                        child: Text(e, style: const TextStyle(fontSize: 26)),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    ),
  );
}

/// Selettore della copertina: restituisce l'indice o -1 per rimuoverla.
Future<int?> pickCover(BuildContext context) {
  return showModalBottomSheet<int>(
    context: context,
    showDragHandle: true,
    builder: (ctx) => Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Copertina', style: Theme.of(ctx).textTheme.titleMedium),
              const Spacer(),
              TextButton(
                onPressed: () => Navigator.pop(ctx, -1),
                child: const Text('Rimuovi'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 1.6,
            children: [
              for (var i = 0; i < coverGradients.length; i++)
                InkWell(
                  onTap: () => Navigator.pop(ctx, i),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(6),
                      gradient: LinearGradient(colors: coverGradients[i]),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    ),
  );
}

/// Elenco dei tipi di blocco (usato da "Trasforma in" e dal pulsante "+").
Future<SlashCommand?> pickBlockType(
  BuildContext context, {
  required String title,
}) {
  return showModalBottomSheet<SlashCommand>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      builder: (ctx, scroll) => ListView(
        controller: scroll,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(title, style: Theme.of(ctx).textTheme.titleMedium),
          ),
          for (final c in slashCommands)
            CommandTile(command: c, onTap: () => Navigator.pop(ctx, c)),
        ],
      ),
    ),
  );
}

class CommandTile extends StatelessWidget {
  const CommandTile({
    super.key,
    required this.command,
    required this.onTap,
    this.selected = false,
  });
  final SlashCommand command;
  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final c = NotionColors.of(context);
    return ListTile(
      dense: true,
      selected: selected,
      selectedTileColor: c.hover,
      onTap: onTap,
      leading: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(6),
          color: Theme.of(context).scaffoldBackgroundColor,
        ),
        child: Text(
          command.icon,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: c.text,
          ),
        ),
      ),
      title: Text(command.label, style: TextStyle(color: c.text)),
      subtitle: Text(
        command.description,
        style: TextStyle(color: c.secondary, fontSize: 12),
      ),
    );
  }
}
