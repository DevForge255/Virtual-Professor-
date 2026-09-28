import React, { useState } from 'react'
import Cards from '../components/Cards'
import New_chapter_button from '../components/New_chapter_button'
import { useAuth } from '../context/AuthContext';
// Export an empty array for now so other files (like Maths.jsx) don't crash immediately
export const subjectsData = [];

const TutorModePage = () => {
  const [subjects, setSubjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { session } = useAuth();

  const fetchSubjects = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/subjects", {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const json = await response.json();

      if (json.status === "success") {
        const formattedData = json.data.map(item => ({
          id: item.subject_id,
          title: item.subject_name,
          chapters: item.chapters.map(chap => chap.name),
          image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=600",
          icon: "📚"
        }));

        setSubjects(formattedData);
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect: Page open hote hi backend se data mangwayega
  React.useEffect(() => {
    fetchSubjects();
  }, []);

  const handleAddSubject = () => {
    // Ab manual state update nahi, seedha DB se fresh data fetch karenge
    fetchSubjects();
  };

  return (
    <div className="relative">

      {/* Header section */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 m-0">Your Subjects (Tutor Mode)</h2>
        <New_chapter_button onAddSubject={handleAddSubject} />
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading subjects...</p>
      ) : (
        <Cards data={subjects} />
      )}

    </div>
  )
}

export default TutorModePage;
