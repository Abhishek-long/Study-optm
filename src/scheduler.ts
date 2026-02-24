/**
 * DSA Logic for Study Scheduling
 */

export interface Subject {
  id: number;
  name: string;
  difficulty: number;
  examDate: string;
  estimatedHours: number;
}

export interface ScheduleItem {
  date: string;
  subjectId: number;
  subjectName: string;
  hours: number;
  type: 'study' | 'revision';
}

/**
 * Custom MinHeap for Priority Queue
 * Time Complexity: O(log N) for insert/extract
 */
export class MinHeap<T> {
  private heap: { priority: number; value: T }[] = [];

  insert(priority: number, value: T) {
    this.heap.push({ priority, value });
    this.heapifyUp(this.heap.length - 1);
  }

  extractMin(): T | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!.value;

    const min = this.heap[0].value;
    this.heap[0] = this.heap.pop()!;
    this.heapifyDown(0);
    return min;
  }

  private heapifyUp(index: number) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.heap[current].priority < this.heap[parent].priority) {
        [this.heap[current], this.heap[parent]] = [this.heap[parent], this.heap[current]];
        current = parent;
      } else break;
    }
  }

  private heapifyDown(index: number) {
    let current = index;
    while (true) {
      let smallest = current;
      const left = 2 * current + 1;
      const right = 2 * current + 2;

      if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }

      if (smallest !== current) {
        [this.heap[current], this.heap[smallest]] = [this.heap[smallest], this.heap[current]];
        current = smallest;
      } else break;
    }
  }

  isEmpty() {
    return this.heap.length === 0;
  }
}

/**
 * Merge Sort to sort subjects by exam date and difficulty
 * Time Complexity: O(N log N)
 */
export function mergeSortSubjects(subjects: Subject[]): Subject[] {
  if (subjects.length <= 1) return subjects;

  const mid = Math.floor(subjects.length / 2);
  const left = mergeSortSubjects(subjects.slice(0, mid));
  const right = mergeSortSubjects(subjects.slice(mid));

  return merge(left, right);
}

function merge(left: Subject[], right: Subject[]): Subject[] {
  const result: Subject[] = [];
  let i = 0, j = 0;

  while (i < left.length && j < right.length) {
    const d1 = new Date(left[i].examDate).getTime();
    const d2 = new Date(right[j].examDate).getTime();

    // Primary: Exam Date (Ascending)
    // Secondary: Difficulty (Descending - harder subjects first if dates are same)
    if (d1 < d2 || (d1 === d2 && left[i].difficulty > right[j].difficulty)) {
      result.push(left[i]);
      i++;
    } else {
      result.push(right[j]);
      j++;
    }
  }

  return result.concat(left.slice(i)).concat(right.slice(j));
}

/**
 * Greedy Scheduling Algorithm with DP constraints
 * Allocates study hours based on urgency and daily limits.
 */
export function generateSchedule(
  subjects: Subject[],
  startDate: Date,
  maxDailyHours: number = 6
): ScheduleItem[] {
  const schedule: ScheduleItem[] = [];
  const sortedSubjects = mergeSortSubjects(subjects);
  
  // Track remaining hours for each subject
  const remainingHoursMap = new Map<number, number>();
  sortedSubjects.forEach(s => remainingHoursMap.set(s.id, s.estimatedHours));

  let currentDate = new Date(startDate);
  
  // Simple DP-like constraint: We don't want to exceed maxDailyHours
  // We also want to distribute work fairly
  
  const totalDaysToPlan = 30; // Plan for next 30 days or until exams
  
  for (let d = 0; d < totalDaysToPlan; d++) {
    const dateStr = currentDate.toISOString().split('T')[0];
    let hoursAllocatedToday = 0;

    // Use a Priority Queue (MinHeap) to decide what to study today
    // Priority = Days until exam / difficulty
    const pq = new MinHeap<Subject>();
    
    sortedSubjects.forEach(s => {
      const remaining = remainingHoursMap.get(s.id) || 0;
      if (remaining > 0) {
        const examDate = new Date(s.examDate);
        const diffDays = Math.max(1, Math.ceil((examDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        if (diffDays > 0) {
          // Priority: Lower value = higher priority
          // We want subjects with fewer days left and higher difficulty to be prioritized
          const priority = diffDays / s.difficulty;
          pq.insert(priority, s);
        }
      }
    });

    // Greedy allocation for the day
    while (!pq.isEmpty() && hoursAllocatedToday < maxDailyHours) {
      const subject = pq.extractMin()!;
      const remaining = remainingHoursMap.get(subject.id)!;
      
      // Allocate in chunks of 1-2 hours to allow variety
      const chunk = Math.min(2, remaining, maxDailyHours - hoursAllocatedToday);
      
      if (chunk > 0) {
        schedule.push({
          date: dateStr,
          subjectId: subject.id,
          subjectName: subject.name,
          hours: chunk,
          type: 'study'
        });
        
        remainingHoursMap.set(subject.id, remaining - chunk);
        hoursAllocatedToday += chunk;

        // Add Revision Sessions: 1, 3, 7 days later
        [1, 3, 7].forEach(daysLater => {
          const revDate = new Date(currentDate);
          revDate.setDate(revDate.getDate() + daysLater);
          const revDateStr = revDate.toISOString().split('T')[0];
          
          // Check if revision is before exam
          if (new Date(revDateStr) < new Date(subject.examDate)) {
             schedule.push({
               date: revDateStr,
               subjectId: subject.id,
               subjectName: subject.name,
               hours: 0.5, // Revision is usually shorter
               type: 'revision'
             });
          }
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schedule;
}
