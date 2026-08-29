import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { LoginForm } from './features/auth/LoginForm'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { EpiceriePage } from './features/epicerie/EpiceriePage'
import { PlannerPage } from './features/planner/PlannerPage'
import { ImportRecipePage } from './features/recettes/ImportRecipePage'
import { RecipeDetailPage } from './features/recettes/RecipeDetailPage'
import { RecipeFormPage } from './features/recettes/RecipeFormPage'
import { RecipesListPage } from './features/recettes/RecipesListPage'
import { useAuth } from './lib/auth'

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-neutral-500">Chargement...</div>
  }

  if (!session) {
    return <LoginForm />
  }

  return (
    <Router>
      <div className="min-h-dvh bg-neutral-50 pb-16 text-neutral-900">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/recettes" element={<RecipesListPage />} />
          <Route path="/recettes/importer" element={<ImportRecipePage />} />
          <Route path="/recettes/nouvelle" element={<RecipeFormPage />} />
          <Route path="/recettes/:id" element={<RecipeDetailPage />} />
          <Route path="/recettes/:id/modifier" element={<RecipeFormPage />} />
          <Route path="/planificateur" element={<PlannerPage />} />
          <Route path="/epicerie" element={<EpiceriePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </Router>
  )
}

export default App
