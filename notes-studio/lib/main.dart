import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'state/workspace.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => Workspace(PrefsStore())..load(),
      child: const NotesStudioApp(),
    ),
  );
}

class NotesStudioApp extends StatefulWidget {
  const NotesStudioApp({super.key});

  @override
  State<NotesStudioApp> createState() => _NotesStudioAppState();
}

class _NotesStudioAppState extends State<NotesStudioApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Salva subito quando l'app va in secondo piano.
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      context.read<Workspace>().flush();
    }
  }

  @override
  Widget build(BuildContext context) {
    final ws = context.watch<Workspace>();
    return MaterialApp(
      title: 'Notes Studio',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: ws.themeMode,
      home: ws.loaded
          ? const HomeScreen()
          : const Scaffold(body: Center(child: CircularProgressIndicator())),
    );
  }
}
