package com.ryuk.automation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ryuk.automation.ui.screens.AutomationEditScreen
import com.ryuk.automation.ui.screens.AutomationListScreen
import com.ryuk.automation.ui.screens.PermissionsScreen
import com.ryuk.automation.ui.theme.RyukAutomationTheme
import com.ryuk.automation.viewmodel.AutomationViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: AutomationViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            RyukAutomationTheme {
                RyukNavHost(viewModel)
            }
        }
    }
}

@Composable
private fun RyukNavHost(viewModel: AutomationViewModel) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "list") {
        composable("list") {
            AutomationListScreen(
                viewModel = viewModel,
                onCreateNew = { navController.navigate("edit/-1") },
                onEdit = { id -> navController.navigate("edit/$id") },
                onOpenPermissions = { navController.navigate("permissions") }
            )
        }
        composable(
            route = "edit/{id}",
            arguments = listOf(navArgument("id") { type = NavType.LongType })
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getLong("id") ?: -1L
            AutomationEditScreen(viewModel = viewModel, automationId = id, onDone = { navController.popBackStack() })
        }
        composable("permissions") {
            PermissionsScreen(onBack = { navController.popBackStack() })
        }
    }
}
