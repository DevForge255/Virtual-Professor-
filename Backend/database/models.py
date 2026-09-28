from sqlalchemy import Column, Integer, String, ForeignKey, Text, JSON
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False) # String for UUIDs/Firebase auth
    name = Column(String, nullable=False)

    # Relationship: Ek subject ke bohot saare chapters ho sakte hain
    chapters = relationship("Chapter", back_populates="subject", cascade="all, delete")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    name = Column(String, nullable=False)

    # Relationships
    subject = relationship("Subject", back_populates="chapters")
    agent_responses = relationship("AgentResponse", back_populates="chapter", cascade="all, delete")


class AgentResponse(Base):
    __tablename__ = "agent_responses"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    
    # Naye JSON type columns analytics ke liye
    tutor_instruct = Column(Text, nullable=True) 
    mistakes = Column(JSON, nullable=True)
    confused_topics = Column(JSON, nullable=True)
    core_weaknesses = Column(JSON, nullable=True)
    chapter_indices = Column(JSON, nullable=True)
    pyq_analysis = Column(JSON, nullable=True)

    # Relationship
    chapter = relationship("Chapter", back_populates="agent_responses")
