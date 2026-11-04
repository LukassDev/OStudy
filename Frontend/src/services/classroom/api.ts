import { ClassroomNotConnectedError, getValidAccessToken } from './auth';

export interface ClassroomCourse {
  id: string;
  name: string;
  courseState?: string;
}

export interface ClassroomCourseWork {
  id: string;
  title: string;
  description?: string;
  creationTime?: string;
  alternateLink?: string;
  workType?: string;
  dueDate?: { year?: number; month?: number; day?: number };
  dueTime?: { hours?: number; minutes?: number };
}

export interface ClassroomAnnouncement {
  id: string;
  text?: string;
  materials?: Array<{ driveFile?: { driveFile?: { alternateLink?: string } } }>;
  creationTime?: string;
  alternateLink?: string;
}

async function fetchClassroom<T>(path: string): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new ClassroomNotConnectedError();
  const response = await fetch(`https://classroom.googleapis.com/v1${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Falha ao consultar o Google Classroom (${response.status}): ${reason}`);
  }
  return response.json() as Promise<T>;
}

export async function listCourses(): Promise<ClassroomCourse[]> {
  const json = await fetchClassroom<{ courses?: ClassroomCourse[] }>(`/courses?courseStates=ACTIVE`);
  return (json.courses ?? []).filter(course => course.courseState !== 'ARCHIVED');
}

export async function listCourseWork(courseId: string): Promise<ClassroomCourseWork[]> {
  const json = await fetchClassroom<{ courseWork?: ClassroomCourseWork[] }>(`/courses/${encodeURIComponent(courseId)}/courseWork`);
  return json.courseWork ?? [];
}

export async function listAnnouncements(courseId: string): Promise<ClassroomAnnouncement[]> {
  const json = await fetchClassroom<{ announcements?: ClassroomAnnouncement[] }>(`/courses/${encodeURIComponent(courseId)}/announcements`);
  return json.announcements ?? [];
}
