import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { RouteError } from './RouteError';
import App from '@/App';
import { Settings } from '@/pages/Settings';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LoginPage } from '@/pages/Auth/LoginPage';
import { SignupPage } from '@/pages/Auth/SignupPage';
import { LibraryPage } from '@/pages/Library/LibraryPage';
import { NewCoursePage } from '@/pages/NewCourse/NewCoursePage';
import { GeneratingPage } from '@/pages/Generating/GeneratingPage';
import { CoursePage } from '@/pages/Course/CoursePage';
import { ChapterPage } from '@/pages/Chapter/ChapterPage';
import { ProjectPage } from '@/pages/Project/ProjectPage';
import { TutorPage } from '@/pages/Tutor/TutorPage';
import { NotesPage } from '@/pages/Notes/NotesPage';
import { SourcesPage } from '@/pages/Sources/SourcesPage';

const rootRoute = createRootRoute({ component: App, notFoundComponent: NotFoundPage });

const loginRoute = createRoute({ path: '/login', component: LoginPage, getParentRoute: () => rootRoute });
const signupRoute = createRoute({ path: '/signup', component: SignupPage, getParentRoute: () => rootRoute });
const libraryRoute = createRoute({ path: '/', component: LibraryPage, getParentRoute: () => rootRoute });
const newRoute = createRoute({ path: '/new', component: NewCoursePage, getParentRoute: () => rootRoute });
const buildingRoute = createRoute({ path: '/courses/$courseId/building', component: GeneratingPage, getParentRoute: () => rootRoute });
const courseRoute = createRoute({ path: '/courses/$courseId', component: CoursePage, getParentRoute: () => rootRoute });
const chapterRoute = createRoute({ path: '/courses/$courseId/chapters/$chapterId', component: ChapterPage, getParentRoute: () => rootRoute });
const projectRoute = createRoute({ path: '/courses/$courseId/projects/$projectId', component: ProjectPage, getParentRoute: () => rootRoute });
const tutorRoute = createRoute({ path: '/tutor', component: TutorPage, getParentRoute: () => rootRoute });
const notesRoute = createRoute({ path: '/notes', component: NotesPage, getParentRoute: () => rootRoute });
const notePageRoute = createRoute({ path: '/notes/$pageId', component: NotesPage, getParentRoute: () => rootRoute });
const sourcesRoute = createRoute({ path: '/sources', component: SourcesPage, getParentRoute: () => rootRoute });
const settingsRoute = createRoute({ path: '/settings', component: Settings, getParentRoute: () => rootRoute });

const routeTree = rootRoute.addChildren([
  loginRoute,
  signupRoute,
  libraryRoute,
  newRoute,
  buildingRoute,
  courseRoute,
  chapterRoute,
  projectRoute,
  tutorRoute,
  notesRoute,
  notePageRoute,
  sourcesRoute,
  settingsRoute,
]);

const router = createRouter({ routeTree, defaultErrorComponent: RouteError });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default router;
